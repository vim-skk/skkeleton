import type { Context } from "../context.ts";
import { fn } from "../deps.ts";

export async function disable(context: Context, _: string) {
  const denops = context.denops!;
  if (await denops.eval("&l:iminsert") === 1) {
    await denops.call("skkeleton#unmap");
    if ((await fn.mode(denops)).match(/i|c/)) {
      context.preEdit.doKakutei("\x1e");
    } else {
      await denops.cmd("setlocal iminsert=0");
    }
  }
}

export async function escape(context: Context, _: string) {
  await disable(context, _);
  context.state.type = "escape";
}
