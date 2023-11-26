import { config, setConfig } from "./config.ts";
import { autocmd, Denops, fn, op, vars } from "./deps.ts";
import { assert, AssertError, is } from "./deps/unknownutil.ts";
import { functions } from "./function.ts";
import { disable as disableFunc } from "./function/disable.ts";
import { initializeStateWithAbbrev, modeChange } from "./mode.ts";
import { hirakana } from "./function/mode.ts";
import { GoogleJapaneseInput, load as jisyoLoad, SkkServer } from "./jisyo.ts";
import { currentKanaTable, registerKanaTable } from "./kana.ts";
import { handleKey, registerKeyMap } from "./keymap.ts";
import { keyToNotation, notationToKey, receiveNotation } from "./notation.ts";
import { currentContext, currentLibrary } from "./store.ts";
import type { CompletionData, RankData, SkkServerOptions } from "./types.ts";
import { homeExpand } from "./util.ts";

type Opts = {
  key: string | string[];
  function?: string;
  expr?: boolean;
};

type CompleteInfo = {
  pum_visible: boolean;
  selected: number;
};

type VimStatus = {
  prevInput: string;
  completeInfo: CompleteInfo;
  completeType: string;
  mode: string;
};

type HandleResult = {
  state: {
    phase: string;
  };
  result: string;
};

// deno-lint-ignore no-explicit-any
function isOpts(x: any): x is Opts {
  return is.String(x?.key) || is.ArrayOf(is.String)(x?.key);
}

function assertOpts(x: unknown): asserts x is Opts {
  if (!isOpts(x)) {
    throw new AssertError("value must be Opts");
  }
}

let initialized = false;

async function init(denops: Denops) {
  if (initialized) {
    return;
  }
  if (config.debug) {
    console.log("skkeleton: initialize");
    console.log(config);
  }
  try {
    await denops.cmd("doautocmd <nomodeline> User skkeleton-initialize-pre");
  } catch (e) {
    console.log(e);
  }
  currentContext.get().denops = denops;
  const {
    completionRankFile,
    userJisyo,
    useGoogleJapaneseInput,
    useSkkServer,
    skkServerHost,
    skkServerPort,
    skkServerResEnc,
    skkServerReqEnc,
  } = config;
  let skkServer: SkkServer | undefined;
  let googleJapaneseInput: GoogleJapaneseInput | undefined;
  let skkServerOptions: SkkServerOptions | undefined;
  if (useSkkServer) {
    skkServerOptions = {
      hostname: skkServerHost,
      port: skkServerPort,
      requestEnc: skkServerReqEnc,
      responseEnc: skkServerResEnc,
    };
    skkServer = new SkkServer(skkServerOptions);
  }
  if (useGoogleJapaneseInput) {
    googleJapaneseInput = new GoogleJapaneseInput();
  }
  const globalDictionaries = await Promise.all(
    (config.globalDictionaries.length === 0
      ? [[config.globalJisyo, config.globalJisyoEncoding]]
      : config.globalDictionaries)
      .map(async (
        cfg,
      ): Promise<[string, string]> => {
        if (is.String(cfg)) {
          return [await homeExpand(cfg, denops), ""];
        } else {
          return [await homeExpand(cfg[0], denops), cfg[1]];
        }
      }),
  );
  currentLibrary.setInitializer(async () =>
    await jisyoLoad(
      globalDictionaries,
      {
        path: await homeExpand(userJisyo, denops),
        rankPath: await homeExpand(completionRankFile, denops),
      },
      skkServer,
      googleJapaneseInput,
    )
  );
  await receiveNotation(denops);
  autocmd.group(denops, "skkeleton-internal-denops", (helper) => {
    helper.remove("*");
    // Note: 使い終わったステートを初期化する
    //       CmdlineEnterにしてしまうと辞書登録時の呼び出しで壊れる
    helper.define(
      ["InsertLeave", "CmdlineLeave"],
      "*",
      `call denops#request('${denops.name}', 'reset', [])`,
    );
    helper.define(
      ["InsertLeave", "CmdlineLeave"],
      "*",
      `call skkeleton#disable()`,
    );
  });
  try {
    await denops.cmd("doautocmd <nomodeline> User skkeleton-initialize-post");
  } catch (e) {
    console.log(e);
  }
  initialized = true;
}

async function enable(opts?: unknown, vimStatus?: unknown): Promise<string> {
  const context = currentContext.get();
  const state = context.state;
  const denops = context.denops!;
  if (await fn.mode(denops) === "R") {
    console.log("skkeleton doesn't allowed in replace mode");
    return "";
  }
  if (
    (state.type !== "input" || state.mode !== "direct") && isOpts(opts) &&
    vimStatus
  ) {
    return handle(opts, vimStatus);
  }
  // Note: must set before context initialization
  currentKanaTable.set(config.kanaTable);

  currentContext.init().denops = denops;
  try {
    await denops.cmd("doautocmd <nomodeline> User skkeleton-enable-pre");
  } catch (e) {
    console.log(e);
  }

  if (context.mode === "zenkaku") {
    hirakana(context);
  }

  // NOTE: Disable textwidth
  currentContext.get().textwidth = await op.textwidth.getLocal(denops);
  await op.textwidth.setLocal(denops, 0);

  await denops.call("skkeleton#map");
  await vars.b.set(denops, "keymap_name", "skkeleton");
  await vars.g.set(denops, "skkeleton#enabled", true);
  await modeChange(currentContext.get(), "hira");
  try {
    await denops.cmd("doautocmd <nomodeline> User skkeleton-enable-post");
  } catch (e) {
    console.log(e);
  }
  return "";
}

async function disable(opts?: unknown, vimStatus?: unknown): Promise<string> {
  const context = currentContext.get();
  const state = currentContext.get().state;
  if (
    (state.type !== "input" || state.mode !== "direct") && isOpts(opts) &&
    vimStatus
  ) {
    return handle(opts, vimStatus);
  }
  await disableFunc(context);
  return context.preEdit.output(context.toString());
}

function handleCompleteKey(
  completed: boolean,
  completeType: string,
  notation: string,
): string | null {
  if (notation === "<cr>") {
    if (completed && config.eggLikeNewline) {
      switch (completeType) {
        case "native":
          return notationToKey["<c-y>"];
        case "pum.vim":
          return "<Cmd>call pum#map#confirm()";
        case "cmp":
          return "<Cmd>lua require('cmp').confirm({select = true})";
      }
    }
  }
  return null;
}

async function handle(
  opts: unknown,
  vimStatus: unknown,
): Promise<string> {
  assertOpts(opts);
  const keyList = is.String(opts.key) ? [opts.key] : opts.key;
  const { prevInput, completeInfo, completeType, mode } =
    vimStatus as VimStatus;
  const context = currentContext.get();
  context.vimMode = mode;
  if (completeInfo.pum_visible) {
    if (config.debug) {
      console.log("input after complete");
    }
    const notation = keyList.map((key) => {
      return keyToNotation[notationToKey[key]] || key;
    }).join("");
    if (config.debug) {
      console.log({
        completeType,
        selected: completeInfo.selected,
      });
    }
    const handled = handleCompleteKey(
      completeInfo.selected >= 0,
      completeType,
      notation,
    );
    if (is.String(handled)) {
      await initializeStateWithAbbrev(context, ["converter"]);
      context.preEdit.output("");
      return handled;
    }
  }
  // 補完の後などpreEditとバッファが不一致している状態の時にリセットする
  if (!prevInput.endsWith(context.toString())) {
    await initializeStateWithAbbrev(context, ["converter"]);
    context.preEdit.output("");
  }
  const before = context.mode;
  if (opts.function) {
    for (const key of keyList) {
      await functions.get()[opts.function](context, key);
    }
  } else {
    for (const key of keyList) {
      await handleKey(context, key);
    }
  }
  const output = context.preEdit.output(context.toString());
  if (output === "" && before !== context.mode) {
    return " \x08";
  }
  return output;
}

function buildResult(result: string): HandleResult {
  const state = currentContext.get().state;
  let phase = "";
  if (state.type === "input") {
    if (state.mode === "okurinasi") {
      phase = "input:okurinasi";
    } else if (state.mode === "okuriari") {
      phase = "input:okuriari";
    } else {
      phase = "input";
    }
  } else {
    phase = state.type;
  }
  return {
    state: {
      phase,
    },
    result,
  };
}

export async function main(denops: Denops) {
  if (await vars.g.get(denops, "skkeleton#debug", false)) {
    config.debug = true;
  }
  denops.dispatcher = {
    async config(config: unknown) {
      assert(config, is.Record);
      await setConfig(config, denops);
      return;
    },
    async registerKeyMap(state: unknown, key: unknown, funcName: unknown) {
      assert(state, is.String);
      assert(key, is.String);
      await receiveNotation(denops);
      registerKeyMap(state, key, funcName);
    },
    registerKanaTable(tableName: unknown, table: unknown, create: unknown) {
      assert(tableName, is.String);
      registerKanaTable(tableName, table, !!create);
      return Promise.resolve();
    },
    async enable(opts: unknown, vimStatus: unknown): Promise<HandleResult> {
      await init(denops);
      return buildResult(await enable(opts, vimStatus));
    },
    async disable(opts: unknown, vimStatus: unknown): Promise<HandleResult> {
      await init(denops);
      return buildResult(await disable(opts, vimStatus));
    },
    async toggle(opts: unknown, vimStatus: unknown): Promise<HandleResult> {
      await init(denops);
      const mode = await vars.g.get(denops, "skkeleton#mode", "");
      if (!await denops.eval("g:skkeleton#enabled") || mode === "") {
        return buildResult(await enable(opts, vimStatus));
      } else {
        return buildResult(await disable(opts, vimStatus));
      }
    },
    async handleKey(opts: unknown, vimStatus: unknown): Promise<HandleResult> {
      return buildResult(await handle(opts, vimStatus));
    },
    reset() {
      currentContext.init().denops = denops;
      return Promise.resolve();
    },
    //completion
    getPreEditLength(): Promise<number> {
      return Promise.resolve(currentContext.get().toString().length);
    },
    getPreEdit(): Promise<string> {
      return Promise.resolve(currentContext.get().toString());
    },
    getPrefix(): Promise<string> {
      const state = currentContext.get().state;
      if (state.type !== "input") {
        return Promise.resolve("");
      }
      return Promise.resolve(state.henkanFeed);
    },
    async getCandidates(): Promise<CompletionData> {
      const state = currentContext.get().state;
      if (state.type !== "input") {
        return Promise.resolve([]);
      }
      const lib = await currentLibrary.get();
      return lib.getCandidates(state.henkanFeed, state.feed);
    },
    async getRanks(): Promise<RankData> {
      const state = currentContext.get().state;
      if (state.type !== "input") {
        return Promise.resolve([]);
      }
      const lib = await currentLibrary.get();
      return Promise.resolve(lib.getRanks(state.henkanFeed));
    },
    async registerCandidate(kana: unknown, word: unknown) {
      // Note: This method is compatible to completion source
      await denops.dispatcher.completeCallback(kana, word);
    },
    async completeCallback(kana: unknown, word: unknown) {
      assert(kana, is.String);
      assert(word, is.String);
      const lib = await currentLibrary.get();
      await lib.registerCandidate("okurinasi", kana, word);
      const context = currentContext.get();
      context.lastCandidate = {
        type: "okurinasi",
        word: kana,
        candidate: word,
      };
    },
    // deno-lint-ignore require-await
    async getConfig() {
      return config;
    },
    async initialize() {
      await init(denops);

      // NOTE: Initialize dictionary
      await currentLibrary.get();
    },
  };
  if (config.debug) {
    await denops.cmd(`echomsg "loaded skkeleton"`);
  }
}
