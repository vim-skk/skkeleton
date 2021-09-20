import { Context } from "../context.ts";
import { autocmd, vars } from "../deps.ts";
import { hiraToKata } from "../kana/hira_kata.ts";
import { asInputState } from "../state.ts";
import { kakuteiFeed } from "./input.ts";

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

export async function katakana(context: Context) {
  if (context.state.type !== "input") {
    return;
  }
  const state = context.state;
  if (state.mode === "direct") {
    if (state.converter) {
      state.converter = void 0;
      await modeChange(context, "hira");
    } else {
      state.converter = hiraToKata;
      state.converterName = "katakana";
      await modeChange(context, "kata");
    }
    return;
  }
  kakuteiFeed(context);
  let result = state.henkanFeed + state.okuriFeed;
  if (!state.converter) {
    result = hiraToKata(result);
  }
  context.preEdit.doKakutei(result);
  asInputState(state);
}
