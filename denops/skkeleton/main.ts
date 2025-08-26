import { config, setConfig } from "./config.ts";
import { functions, modeFunctions } from "./function.ts";
import { disable as disableFunc } from "./function/disable.ts";
import { isHenkanType, load as loadDictionary } from "./dictionary.ts";
import { Dictionary as DenoKvDictionary } from "./sources/deno_kv.ts";
import {
  currentKanaTable,
  loadKanaTableFile,
  registerKanaTable,
} from "./kana.ts";
import { handleKey, registerKeyMap } from "./keymap.ts";
import { initializeStateWithAbbrev } from "./mode.ts";
import { keyToNotation, notationToKey, receiveNotation } from "./notation.ts";
import { currentContext, currentLibrary, variables } from "./store.ts";
import type { CompletionData, RankData } from "./types.ts";

import { as, assert, is } from "@core/unknownutil";
import type { Denops, Entrypoint } from "@denops/std";
import * as autocmd from "@denops/std/autocmd";
import * as fn from "@denops/std/function";
import * as vars from "@denops/std/variable";

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

const isOpts = is.ObjectOf({
  function: as.Optional(is.String),
  key: is.ArrayOf(is.String),
});

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
  currentContext.init().denops = denops;

  currentLibrary.setInitializer(() =>
    loadDictionary(
      config.sources,
    )
  );

  await receiveNotation(denops);

  autocmd.group(denops, "skkeleton-internal-denops", (helper) => {
    helper.remove("*");
    // Note: 使い終わったステートを初期化する
    //       CmdlineEnterにしてしまうと辞書登録時の呼び出しで壊れる
    //       挿入モードの`<C-o>`(niI)などで解除されると困るのでModeChangedの:nにしておく
    //       SafeStateトランポリンをしているのはプラグインによるModeChangedの呼び出しで解除されるのを防ぐため
    //       このイベントはユーザーの操作を受け付けるタイミングで呼ばれるので、そこでNormalなら改めて処理を行う
    helper.define(
      ["ModeChanged"],
      "*:n",
      "autocmd SafeState * ++once " + [
        "if mode() == 'n'",
        `call denops#request('${denops.name}', 'reset', [])`,
        `call skkeleton#disable()`,
        "endif",
      ].join("|"),
    );
  });

  try {
    await denops.cmd("doautocmd <nomodeline> User skkeleton-initialize-post");
  } catch (e) {
    console.log(e);
  }

  initialized = true;
}

async function enable(opts: unknown, vimStatus: unknown): Promise<string> {
  const oldContext = currentContext.get();
  const oldState = oldContext.state;
  const denops = oldContext.denops!;
  if (await fn.mode(denops) === "R") {
    console.log("skkeleton doesn't allowed in replace mode");
    return "";
  }
  if ((oldState.type !== "input" || oldState.mode !== "direct") && vimStatus) {
    return handle(opts, vimStatus);
  }
  // Note: must set before context initialization
  currentKanaTable.set(config.kanaTable);
  const context = currentContext.init();
  context.denops = denops;

  try {
    await denops.cmd("doautocmd <nomodeline> User skkeleton-enable-pre");
  } catch (e) {
    console.log(e);
  }

  await denops.call("skkeleton#internal#option#save_and_set");
  await denops.call("skkeleton#map");
  await vars.g.set(denops, "skkeleton#enabled", true);
  await modeFunctions.get()[variables.lastMode]?.(context, "");
  try {
    await denops.cmd("doautocmd <nomodeline> User skkeleton-enable-post");
  } catch (e) {
    console.log(e);
  }
  return "";
}

async function disable(opts: unknown, vimStatus: unknown): Promise<string> {
  const context = currentContext.get();
  const state = currentContext.get().state;
  // Note: plugin/skkeleton.vimで定義している物はoptsが空なのでこっちは呼ばない
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
  assert(opts, isOpts);
  const keyList = opts.key.map((key) => {
    return keyToNotation[notationToKey[key]] ?? key;
  });
  const { completeInfo, completeType, mode } = vimStatus as VimStatus;
  const context = currentContext.get();
  context.vimMode = mode;
  if (completeInfo.pum_visible) {
    if (config.debug) {
      console.log("input after complete");
    }
    const notation = keyList.join("");
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

export const main: Entrypoint = async (denops) => {
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
    async registerKanaTableFile(
      tableName: unknown,
      path: unknown,
      encoding: unknown,
      create: unknown,
    ) {
      assert(tableName, is.String);
      assert(path, is.String);
      assert(encoding, is.String);
      await loadKanaTableFile(tableName, path, encoding, !!create);
      return Promise.resolve();
    },
    async handle(
      func: unknown,
      opts: unknown,
      vimStatus: unknown,
    ): Promise<HandleResult> {
      await init(denops);
      const { mode, prevInput } = vimStatus as VimStatus;
      const context = currentContext.get();
      // 補完の後などpreEditとバッファが不一致している状態の時にリセットする
      if (mode !== "t" && !prevInput.endsWith(context.toString())) {
        await initializeStateWithAbbrev(context, ["converter"]);
        context.preEdit.output("");
      }
      if (func === "handleKey") {
        return buildResult(await handle(opts, vimStatus));
      } else if (func === "setState") {
        return buildResult(await enable(opts, vimStatus));
      } else if (func === "enable") {
        return buildResult(await enable(opts, vimStatus));
      } else if (func === "disable") {
        return buildResult(await disable(opts, vimStatus));
      } else if (func === "toggle") {
        const noMode = await vars.g.get(denops, "skkeleton#mode", "") === "";
        const disabled = noMode || !await denops.eval("g:skkeleton#enabled");
        return buildResult(
          await (disabled ? enable(opts, vimStatus) : disable(opts, vimStatus)),
        );
      }
      throw "Unsupported function: " + func;
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
    async getCandidates(kana: unknown, type: unknown = "okurinasi") {
      assert(kana, is.String);
      assert(type, isHenkanType);
      const lib = await currentLibrary.get();
      return await lib.getHenkanResult(type, kana);
    },
    async getCompletionResult(): Promise<CompletionData> {
      const state = currentContext.get().state;
      if (state.type !== "input") {
        return Promise.resolve([]);
      }
      const lib = await currentLibrary.get();
      return lib.getCompletionResult(state.henkanFeed, state.feed);
    },
    async getRanks(): Promise<RankData> {
      const state = currentContext.get().state;
      if (state.type !== "input") {
        return Promise.resolve([]);
      }
      const lib = await currentLibrary.get();
      return Promise.resolve(lib.getRanks(state.henkanFeed));
    },
    async registerHenkanResult(midasi: unknown, word: unknown) {
      // Note: This method is compatible to completion source
      await denops.dispatcher.completeCallback(midasi, word);
    },
    async completeCallback(
      midasi: unknown,
      word: unknown,
      type: unknown = "okurinasi",
    ) {
      assert(midasi, is.String);
      assert(word, is.String);
      assert(type, isHenkanType);
      const lib = await currentLibrary.get();
      await lib.registerHenkanResult(type, midasi, word);
      const context = currentContext.get();
      context.lastCandidate = {
        type,
        word: midasi,
        candidate: word,
      };
    },
    // deno-lint-ignore require-await
    async getConfig() {
      return config;
    },
    async initialize(force = false) {
      if (force) {
        initialized = false;
      }
      await init(denops);

      // NOTE: Initialize dictionary
      await currentLibrary.get();
    },
    async updateDatabase(path: unknown, encoding: unknown, force: unknown) {
      assert(path, is.String);
      assert(encoding, is.String);
      assert(force, is.Boolean);
      await DenoKvDictionary.create(path, encoding)
        .then((dict) => dict.load(force));
      await denops.cmd(`echomsg 'updated database: "${path}"'`);
    },
  };
  if (config.debug) {
    await denops.cmd(`echomsg "loaded skkeleton"`);
  }
  return {
    [Symbol.asyncDispose]: async () => {
      initialized = false;
      currentLibrary.init(); // TODO: dispose loaded dictionaries
      await autocmd.group(denops, "skkeleton-internal-denops", (helper) => {
        helper.remove("*");
      });
    },
  };
};
