import { config } from "../config.ts";
import { Context } from "../context.ts";
import { autocmd, batch, fn, mapping, op, vars } from "../deps.ts";
import { currentContext } from "../store.ts";
import { HenkanState } from "../state.ts";
import { kakutei } from "./common.ts";
import { modeChange } from "../mode.ts";

const cmapKeys = ["<Esc>", "<C-g>"];

export async function jisyoTouroku(context: Context): Promise<boolean> {
  const denops = context.denops!;
  const state = context.state as HenkanState;
  await batch(denops, async (denops) => {
    await denops.call("skkeleton#save_map", "c", cmapKeys);
    for (const k of cmapKeys) {
      await mapping.map(denops, k, "__skkeleton_return__<CR>", {
        buffer: true,
        mode: "c",
      });
    }
  });
  // Note: use virtualedit for fix slip cursor position at line ending.
  const saveVirtualedit = await op.virtualedit.getLocal(denops);
  await op.virtualedit.setLocal(denops, "all");
  try {
    const base = "[辞書登録] " + state.henkanFeed;
    const okuri = state.mode === "okuriari" ? "*" + state.okuriFeed : "";
    currentContext.init().denops = denops;
    await autocmd.define(denops, "CmdlineEnter", "*", "call skkeleton#map()", {
      once: true,
    });
    const input = await fn.input(denops, base + okuri + ": ");
    if (input === "" || input.includes("__skkeleton_return__")) {
      await denops.cmd("echo '' | redraw");
      return false;
    }
    state.candidates = [input];
    state.candidateIndex = 0;
    await kakutei(context);
    return true;
  } catch (e) {
    if (config.debug) {
      console.log("jisyo touroku interrupted");
      console.log(e);
    }
  } finally {
    await batch(denops, async (denops) => {
      await autocmd.emit(denops, "User", "skkeleton-enable-pre", {
        nomodeline: true,
      });
      // restore skkeleton mode
      await denops.call("skkeleton#map");
      await vars.g.set(denops, "skkeleton#enabled", true);
      await denops.cmd("redrawstatus");
    });
    await op.virtualedit.setLocal(denops, saveVirtualedit);
    // restore stashed context
    currentContext.set(context);
    // and mode
    await modeChange(context, context.mode);
    await autocmd.emit(denops, "User", "skkeleton-enable-post", {
      nomodeline: true,
    });
  }
  return false;
}
