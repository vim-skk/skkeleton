import { config } from "./config.ts";
import { Context } from "./context.ts";
import { initializeState } from "./state.ts";
import { variables } from "./store.ts";

import * as autocmd from "@denops/std/autocmd";
import * as vars from "@denops/std/variable";

export async function modeChange(context: Context, mode: string) {
  context.mode = mode;
  const d = context.denops;
  if (d) {
    await vars.g.set(d, "skkeleton#mode", mode);
    try {
      await autocmd.emit(d, "User", "skkeleton-mode-changed", {
        nomodeline: true,
      });
    } catch {
      // ignore
    }
  }
  if (config.keepMode) {
    variables.lastMode = mode;
  }
}

export async function initializeStateWithAbbrev(
  context: Context,
  ignore: string[] = [],
) {
  if (context.mode === "abbrev") {
    ignore = ignore.filter((key) => key !== "converter" && key !== "table");
    initializeState(context.state, ignore);
    if (context.onAbbrevDone) {
      // onAbbrevDoneがある場合はmodeChange("hira")をスキップし
      // コールバックに後処理を委ねる（例: disable）
      const callback = context.onAbbrevDone;
      context.onAbbrevDone = undefined;
      await callback();
    } else {
      await modeChange(context, "hira");
    }
    return;
  }
  initializeState(context.state, ignore);
}
