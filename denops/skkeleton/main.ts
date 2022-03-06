import { config, setConfig } from "./config.ts";
import { Context } from "./context.ts";
import { anonymous, autocmd, Denops, fn, op, vars } from "./deps.ts";
import { ensureObject, ensureString, isString } from "./deps/unknownutil.ts";
import { disable as disableFunc } from "./function/disable.ts";
import { modeChange } from "./function/mode.ts";
import * as jisyo from "./jisyo.ts";
import { currentLibrary, SkkServer } from "./jisyo.ts";
import { registerKanaTable } from "./kana.ts";
import { handleKey, registerKeyMap } from "./keymap.ts";
import { keyToNotation, notationToKey, receiveNotation } from "./notation.ts";
import { resetState } from "./state.ts";
import type { CompletionData, RankData, SkkServerOptions } from "./types.ts";
import { Cell } from "./util.ts";

let initialized = false;

export const currentContext = new Cell(() => new Context());

function homeExpand(path: string, homePath: string): string {
  if (path[0] === "~") {
    return homePath + path.slice(1);
  } else {
    return path;
  }
}

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
    globalJisyo,
    userJisyo,
    globalJisyoEncoding,
    useSkkServer,
    skkServerHost,
    skkServerPort,
    skkServerResEnc,
    skkServerReqEnc,
  } = config;
  let skkServer: SkkServer | undefined;
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
  const homePath = await fn.expand(denops, "~") as string;
  jisyo.currentLibrary.set(
    await jisyo.load(
      homeExpand(globalJisyo, homePath),
      {
        path: homeExpand(userJisyo, homePath),
        rankPath: homeExpand(completionRankFile, homePath),
      },
      globalJisyoEncoding,
      skkServer,
    ),
  );
  await receiveNotation(denops);
  const id = anonymous.add(denops, () => {
    currentContext.init().denops = denops;
  })[0];
  autocmd.group(denops, "skkeleton", (helper) => {
    helper.define(
      ["InsertEnter"],
      "*",
      `call denops#notify('${denops.name}', '${id}', [])`,
    );
  });
  try {
    await denops.cmd("doautocmd <nomodeline> User skkeleton-initialize-post");
  } catch (e) {
    console.log(e);
  }
  initialized = true;
}

async function enable(key?: unknown, vimStatus?: unknown): Promise<string> {
  const context = currentContext.get();
  const state = context.state;
  const denops = context.denops!;
  if (await fn.mode(denops) === "R") {
    console.log("skkeleton doesn't allowed in replace mode");
    return "";
  }
  if ((state.type !== "input" || state.mode !== "direct") && key && vimStatus) {
    return handle(key, vimStatus);
  }
  if (await denops.eval("&l:iminsert") !== 1) {
    currentContext.init().denops = denops;
    try {
      await denops.cmd("doautocmd <nomodeline> User skkeleton-enable-pre");
    } catch (e) {
      console.log(e);
    }
    await denops.call("skkeleton#map");
    await op.iminsert.setLocal(denops, 1);
    await vars.b.set(denops, "keymap_name", "skkeleton");
    try {
      await denops.cmd("doautocmd <nomodeline> User skkeleton-enable-post");
    } catch (e) {
      console.log(e);
    }
    await vars.g.set(denops, "skkeleton#enabled", true);
    await modeChange(currentContext.get(), "hira");
    return "\x1e"; // <C-^>
  } else {
    return "";
  }
}

async function disable(key?: unknown, vimStatus?: unknown): Promise<string> {
  const context = currentContext.get();
  const state = currentContext.get().state;
  if ((state.type !== "input" || state.mode !== "direct") && key && vimStatus) {
    return handle(key, vimStatus);
  }
  await disableFunc(context);
  return context.preEdit.output(context.toString());
}

function handleCompleteKey(
  completed: boolean,
  notation: string,
): string | null {
  if (notation === "<c-y>") {
    if (completed) {
      const context = currentContext.get();
      resetState(context.state);
    }
    return notationToKey["<c-y>"];
  }
  if (notation === "<enter>") {
    if (completed && config.eggLikeNewline) {
      return notationToKey["<c-y>"];
    }
  }
  return null;
}

type CompleteInfo = {
  // Note: This is not implemeted in native completion
  inserted?: string;
  items: string[];
  // deno-lint-ignore camelcase
  pum_visible: boolean;
  selected: number;
};

type VimStatus = {
  completeInfo: CompleteInfo;
  isNativePum: boolean;
  mode: string;
};

async function handle(key: unknown, vimStatus: unknown): Promise<string> {
  ensureString(key);
  const { completeInfo, isNativePum, mode } = vimStatus as VimStatus;
  const context = currentContext.get();
  context.vimMode = mode;
  if (completeInfo.pum_visible) {
    if (config.debug) {
      console.log("input after complete");
    }
    const notation = keyToNotation[notationToKey[key]];
    if (notation === "<tab>" && config.tabCompletion) {
      if (isNativePum) {
        return notationToKey["<c-n>"];
      } else {
        return "<Cmd>call pum#map#insert_relative(+1)";
      }
    }
    if (notation === "<s-tab>" && config.tabCompletion) {
      if (isNativePum) {
        return notationToKey["<c-p>"];
      } else {
        return "<Cmd>call pum#map#insert_relative(-1)";
      }
    }

    const completed = !!((isNativePum ||
      completeInfo.inserted) && completeInfo.selected >= 0);
    if (config.debug) {
      console.log({
        isNativePum,
        inserted: completeInfo.inserted,
        selected: completeInfo.selected,
      });
    }
    if (completed) {
      if (config.debug) {
        console.log("candidate selected");
        console.log({
          candidate: completeInfo.items[completeInfo.selected],
          context: context.toString(),
        });
      }
      resetState(context.state);
      context.preEdit.output("");
    }
    const handled = handleCompleteKey(completed, notation);
    if (isString(handled)) {
      return handled;
    }
  }
  const before = context.mode;
  await handleKey(context, key);
  const output = context.preEdit.output(context.toString());
  if (output === "" && before !== context.mode) {
    return " \x08";
  }
  return output;
}

export async function main(denops: Denops) {
  if (await vars.g.get(denops, "skkeleton#debug", false)) {
    config.debug = true;
  }
  denops.dispatcher = {
    config(config: unknown) {
      ensureObject(config);
      setConfig(config);
      return Promise.resolve();
    },
    async registerKeyMap(state: unknown, key: unknown, funcName: unknown) {
      ensureString(state);
      ensureString(key);
      await receiveNotation(denops);
      registerKeyMap(state, key, funcName);
    },
    registerKanaTable(tableName: unknown, table: unknown, create: unknown) {
      ensureString(tableName);
      registerKanaTable(tableName, table, !!create);
      return Promise.resolve();
    },
    async enable(key: unknown, vimStatus: unknown): Promise<string> {
      await init(denops);
      return await enable(key, vimStatus);
    },
    async disable(key: unknown, vimStatus: unknown): Promise<string> {
      await init(denops);
      return await disable(key, vimStatus);
    },
    async toggle(key: unknown, vimStatus: unknown): Promise<string> {
      await init(denops);
      const mode = await vars.g.get(denops, "skkeleton#mode", "");
      if (await denops.eval("&l:iminsert") !== 1 || mode === "") {
        return await enable(key, vimStatus);
      } else {
        return await disable(key, vimStatus);
      }
    },
    handleKey(key: unknown, vimStatus: unknown): Promise<string> {
      return handle(key, vimStatus);
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
    getCandidates(): Promise<CompletionData> {
      const state = currentContext.get().state;
      if (state.type !== "input") {
        return Promise.resolve([]);
      }
      return currentLibrary.get().getCandidates(state.henkanFeed);
    },
    getRanks(): Promise<RankData> {
      const state = currentContext.get().state;
      if (state.type !== "input") {
        return Promise.resolve([]);
      }
      return Promise.resolve(currentLibrary.get().getRanks(state.henkanFeed));
    },
    async registerCandidate(kana: unknown, word: unknown) {
      ensureString(kana);
      ensureString(word);
      await currentLibrary.get().registerCandidate("okurinasi", kana, word);
    },
  };
  if (config.debug) {
    await denops.cmd(`echomsg "loaded skkeleton"`);
  }
}
