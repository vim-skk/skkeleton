import { config, setConfig } from "./config.ts";
import { Context } from "./context.ts";
import {
  anonymous,
  autocmd,
  Denops,
  ensureObject,
  ensureString,
  isString,
  op,
  vars,
} from "./deps.ts";
import { disable as disableFunc } from "./function/disable.ts";
import * as jisyo from "./jisyo.ts";
import { currentLibrary } from "./jisyo.ts";
import { registerKanaTable } from "./kana.ts";
import { handleKey } from "./keymap.ts";
import { keyToNotation, notationToKey, receiveNotation } from "./notation.ts";
import { asInputState } from "./state.ts";
import { Cell } from "./util.ts";

let initialized = false;

export const currentContext = new Cell(() => new Context());

async function init(denops: Denops) {
  if (config.debug) {
    console.log("skkeleton: initialize");
    console.log(config);
  }
  currentContext.get().denops = denops;
  const { globalJisyo, userJisyo, globalJisyoEncoding } = config;
  jisyo.currentLibrary.set(
    await jisyo.load(globalJisyo, userJisyo, globalJisyoEncoding),
  );
  await receiveNotation(denops);
  const id = anonymous.add(denops, () => {
    currentContext.init().denops = denops;
  })[0];
  autocmd.group(denops, "skkeleton", (helper) => {
    helper.define(
      ["InsertEnter", "CmdlineEnter"],
      "*",
      `call denops#notify('${denops.name}', '${id}', [])`,
    );
  });
}

async function enable(denops: Denops): Promise<string> {
  if (!initialized) {
    await init(denops);
    initialized = true;
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
    return "\x1e"; // <C-^>
  } else {
    return "";
  }
}

async function disable(key?: unknown, vimStatus?: unknown): Promise<string> {
  const context = currentContext.get();
  const state = currentContext.get().state;
  if (state.type !== "input" || state.mode !== "direct" && key && vimStatus) {
    return handle(key, vimStatus);
  }
  await disableFunc(context);
  return context.preEdit.output(context.toString());
}

function handleCompleteKey(completed: boolean, key: unknown): string | null {
  ensureString(key);
  const notation = keyToNotation[key];
  if (notation === "<c-y>") {
    if (completed) {
      const context = currentContext.get();
      asInputState(context.state);
    }
    return key;
  }
  if (notation === "<enter>") {
    if (completed && config.eggLikeNewline) {
      return notationToKey["<c-y>"];
    }
  }
  if (notation === "<tab>" && config.tabCompletion) {
    return notationToKey["<c-n>"];
  }
  if (notation === "<s-tab>" && config.tabCompletion) {
    return notationToKey["<c-p>"];
  }
  return null;
}

async function handle(key: unknown, vimStatus: unknown): Promise<string> {
  ensureString(key);
  ensureObject(vimStatus);
  const { mode, completeStr } = vimStatus;
  ensureString(mode);
  const context = currentContext.get();
  context.vimMode = mode;
  if (isString(completeStr)) {
    if (config.debug) {
      console.log("input after complete");
    }
    const completed = !(completeStr.endsWith(context.toString()));
    if (completed) {
      if (config.debug) {
        console.log("candidate selected");
        console.log({ completeStr, context: context.toString() });
      }
      asInputState(context.state);
      context.preEdit.output("");
    }
    const handled = handleCompleteKey(completed, key);
    if (isString(handled)) {
      return handled;
    }
  }
  await handleKey(context, key);
  return context.preEdit.output(context.toString());
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
    registerKanaTable(tableName: unknown, table: unknown, create: unknown) {
      ensureString(tableName);
      registerKanaTable(tableName, table, !!create);
      return Promise.resolve();
    },
    enable(): Promise<string> {
      return enable(denops);
    },
    disable(key: unknown, vimStatus: unknown): Promise<string> {
      return disable(key, vimStatus);
    },
    async toggle(key?: unknown, vimStatus?: unknown): Promise<string> {
      if (await denops.eval("&l:iminsert") !== 1) {
        return enable(denops);
      } else {
        return disable(key, vimStatus);
      }
    },
    handleKey(key: unknown, vimStatus: unknown): Promise<string> {
      return handle(key, vimStatus);
    },
    //completion
    getPreEditLength(): Promise<number> {
      return Promise.resolve(currentContext.get().toString().length);
    },
    getPrefix(): Promise<string> {
      const state = currentContext.get().state;
      if (state.type !== "input") {
        return Promise.resolve("");
      }
      return Promise.resolve(state.henkanFeed);
    },
    getCandidates(): Promise<[string, string[]][]> {
      const state = currentContext.get().state;
      if (state.type !== "input") {
        return Promise.resolve([]);
      }
      return Promise.resolve(
        currentLibrary.get().getCandidates(state.henkanFeed),
      );
    },
    registerCandidate(kana: unknown, word: unknown) {
      ensureString(kana);
      ensureString(word);
      currentLibrary.get().registerCandidate("okurinasi", kana, word);
      return Promise.resolve();
    },
  };
  if (config.debug) {
    await denops.cmd(`echomsg "loaded skkeleton"`);
  }
}
