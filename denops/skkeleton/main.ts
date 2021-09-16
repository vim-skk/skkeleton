import { config, setConfig } from "./config.ts";
import { Context } from "./context.ts";
import {
  anonymous,
  autocmd,
  Denops,
  ensureObject,
  ensureString,
  op,
  vars,
} from "./deps.ts";
import { disable as disableFunc } from "./function/disable.ts";
import * as jisyo from "./jisyo.ts";
import { currentLibrary } from "./jisyo.ts";
import { registerKanaTable } from "./kana.ts";
import { handleKey } from "./keymap.ts";
import { receiveNotation } from "./notation.ts";
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

async function disable(key?: unknown, vimMode?: unknown): Promise<string> {
  const context = currentContext.get();
  const state = currentContext.get().state;
  if (state.type !== "input" || state.mode !== "direct" && key && vimMode) {
    return handle(key, vimMode);
  }
  await disableFunc(context);
  return context.preEdit.output(context.toString());
}

async function handle(key: unknown, vimMode: unknown): Promise<string> {
  ensureString(key);
  ensureString(vimMode);
  const context = currentContext.get();
  context.vimMode = vimMode;
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
    disable(key: unknown, vimMode: unknown): Promise<string> {
      return disable(key, vimMode);
    },
    async toggle(key?: unknown, vimMode?: unknown): Promise<string> {
      if (await denops.eval("&l:iminsert") !== 1) {
        return enable(denops);
      } else {
        return disable(key, vimMode);
      }
    },
    handleKey(key: unknown, vimMode: unknown): Promise<string> {
      return handle(key, vimMode);
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
  };
  if (config.debug) {
    await denops.cmd(`echomsg "loaded skkeleton"`);
  }
}
