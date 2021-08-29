import type { Context } from "../context.ts";
import { vars } from "../deps.ts";

export async function disable(context: Context, _: string) {
  const denops = context.denops!;
  if (await denops.eval("&l:iminsert") === 1) {
    try {
      await denops.cmd("doautocmd <nomodeline> User skkeleton-disable-pre");
    } catch (e) {
      console.log(e);
    }
    await denops.call("skkeleton#unmap");
    await denops.cmd("setlocal iminsert=0");
    context.preEdit.doKakutei("\x1e");
    try {
      await denops.cmd("doautocmd <nomodeline> User skkeleton-disable-post");
    } catch (e) {
      console.log(e);
    }
    await vars.g.set(denops, "skkeleton#enabled", false);
  }
}

export async function escape(context: Context, _: string) {
  await disable(context, _);
  context.state.type = "escape";
}
