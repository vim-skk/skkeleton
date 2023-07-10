import { Context } from "./context.ts";
import { autocmd, vars } from "./deps.ts";
import { initializeState } from "./state.ts";

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
}

export async function initializeStateWithAbbrev(
  context: Context,
  ignore: string[] = [],
) {
  if (context.mode === "abbrev") {
    await modeChange(context, "hira");
    ignore = ignore.filter((key) => key !== "converter" && key !== "table");
  }
  initializeState(context.state, ignore);
}
