import { config } from "../config.ts";
import type { Context } from "../context.ts";
import { autocmd, op, vars } from "../deps.ts";
import { asInputState } from "../state.ts";

export async function disable(context: Context, _: string) {
  const denops = context.denops!;
  if (await denops.eval("&l:iminsert") === 1) {
    try {
      await denops.cmd("doautocmd <nomodeline> User skkeleton-disable-pre");
    } catch (e) {
      console.log(e);
    }
    await denops.call("skkeleton#unmap");
    await op.iminsert.setLocal(denops, 0);
    context.preEdit.doKakutei("\x1e");
    try {
      await denops.cmd("doautocmd <nomodeline> User skkeleton-disable-post");
    } catch (e) {
      console.log(e);
    }
    await vars.g.set(denops, "skkeleton#enabled", false);
  }
  asInputState(context.state);
}

export async function escape(context: Context, _: string) {
  const denops = context.denops!;
  if (config.keepState) {
    autocmd.group(denops, "skkeleton", (helper) => {
      helper.define(
        "InsertEnter",
        "<buffer>",
        `call denops#request('${denops.name}', 'enable', [])`,
        { once: true },
      );
    });
  }
  await disable(context, _);
  context.state.type = "escape";
}
