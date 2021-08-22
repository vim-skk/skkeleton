import * as jisyo from "./jisyo.ts";
import { Cell } from "./util.ts";
import { Context } from "./context.ts";
import { autocmd, Denops, ensureString, fn, vars } from "./deps.ts";
import { handleKey } from "./keymap.ts";
import { receiveNotation } from "./notation.ts";

export const currentContext = new Cell(new Context());

async function init(denops: Denops) {
  const globalJisyo = await vars.g.get(
    denops,
    "skkeleton#global_jisyo",
    "/usr/share/skk/SKK-JISYO.L",
  );
  ensureString(globalJisyo);
  const globalJisyoEncoding = await vars.g.get(
    denops,
    "skkeleton#global_jisyo_encoding",
    "euc-jp",
  );
  ensureString(globalJisyoEncoding);
  const userJisyo = await vars.g.get(
    denops,
    "skkeleton#user_jisyo",
    Deno.env.get("HOME") + "/.skkeleton",
  );
  ensureString(userJisyo);
  jisyo.currentLibrary.set(
    await jisyo.load(globalJisyo, userJisyo, globalJisyoEncoding),
  );
  await receiveNotation(denops);
}

export async function main(denops: Denops) {
  init(denops);
  denops.dispatcher = {
    async enable(): Promise<string> {
      if (await denops.eval("&l:iminsert") !== 1) {
        await denops.call("skkeleton#map");
        // ノーマルモード等ではsetlocal、挿入モード等では<C-^>が必要
        await denops.cmd("setlocal iminsert=1");
        await vars.b.set(denops, "keymap_name", "skkeleton");
        // とりあえず雑にコンテキスト生成
        // TODO: 後で直す
        const context = new Context();
        context.denops = denops;
        currentContext.set(context);
        return "\x1e"; // <C-^>
      } else {
        return "";
      }
    },
    async handleKey(key: unknown): Promise<string> {
      ensureString(key);
      const context = currentContext.get();
      await handleKey(context, key);
      return context.preEdit.output(context.toString());
    },
  };
  await denops.cmd(`echomsg "loaded skkeleton"`);
}
