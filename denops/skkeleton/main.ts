import { config, setConfig } from "./config.ts";
import { Context } from "./context.ts";
import {
  anonymous,
  autocmd,
  Denops,
  ensureObject,
  ensureString,
  vars,
} from "./deps.ts";
import * as jisyo from "./jisyo.ts";
import { handleKey } from "./keymap.ts";
import { receiveNotation } from "./notation.ts";
import { Cell } from "./util.ts";

let initialized = false;

export const currentContext = new Cell(new Context());

async function init(denops: Denops) {
  currentContext.get().denops = denops;
  const { globalJisyo, userJisyo, globalJisyoEncoding } = config;
  jisyo.currentLibrary.set(
    await jisyo.load(globalJisyo, userJisyo, globalJisyoEncoding),
  );
  await receiveNotation(denops);
  const id = anonymous.add(denops, () => {
    const context = new Context();
    context.denops = denops;
    currentContext.set(context);
  })[0];
  autocmd.group(denops, "skkeleton", (helper) => {
    helper.define(
      ["InsertEnter", "CmdlineEnter"],
      "*",
      `call denops#notify('${denops.name}', '${id}', [])`,
    );
  });
}

export async function main(denops: Denops) {
  denops.dispatcher = {
    config(config: unknown) {
      ensureObject(config);
      setConfig(config);
      return Promise.resolve();
    },
    async enable(): Promise<string> {
      if (!initialized) {
        await init(denops);
        initialized = true;
      }
      if (await denops.eval("&l:iminsert") !== 1) {
        await denops.call("skkeleton#map");
        await denops.cmd("setlocal iminsert=1");
        await vars.b.set(denops, "keymap_name", "skkeleton");
        return "\x1e"; // <C-^>
      } else {
        return "";
      }
    },
    async handleKey(key: unknown, vimMode: unknown): Promise<string> {
      ensureString(key);
      ensureString(vimMode);
      const context = currentContext.get();
      context.vimMode = vimMode;
      await handleKey(context, key);
      return context.preEdit.output(context.toString());
    },
  };
  if (config.debug) {
    await denops.cmd(`echomsg "loaded skkeleton"`);
  }
}
