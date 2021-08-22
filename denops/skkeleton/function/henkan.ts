import { config } from "../config.ts";
import type { Context } from "../context.ts";
import { currentLibrary } from "../jisyo.ts";
import { handleKey } from "../keymap.ts";
import { getOkuriStr } from "../okuri.ts";
import { asInputState } from "../state.ts";
import type { HenkanState } from "../state.ts";
import { undoPoint } from "../util.ts";
import { kanaInput } from "./input.ts";

export async function henkanFirst(context: Context, key: string) {
  if (context.state.type !== "input") {
    return;
  }

  if (context.state.mode === "direct") {
    await kanaInput(context, key);
    return;
  }

  const state = context.state as unknown as HenkanState;
  state.type = "henkan";
  const mode = context.state.mode === "henkan" ? "okurinasi" : "okuriari";
  state.mode = mode;
  state.candidates = [];
  state.candidateIndex = -1;

  const lib = currentLibrary.get();
  const word = mode === "okurinasi"
    ? state.henkanFeed
    : getOkuriStr(state.henkanFeed, state.okuriFeed);
  state.candidates = lib.getCandidates(mode, word);
  await henkanForward(context, key);
}

export async function henkanForward(context: Context, _?: string) {
  const state = context.state;
  if (state.type !== "henkan") {
    return;
  }
  state.candidateIndex++;
  if (state.candidates.length <= state.candidateIndex) {
    // TODO: 辞書登録
  }
  await Promise.resolve();
}

export function henkanBackward(context: Context, _?: string) {
  const state = context.state;
  if (state.type !== "henkan") {
    return;
  }
  state.candidateIndex--;
  if (state.candidateIndex === -1) {
    // TODO: 戻す
  }
}

export function kakutei(context: Context, _?: string) {
  const state = context.state;
  switch (state.type) {
    case "henkan": {
      const ret = (state.candidates[state.candidateIndex] ?? "error") +
        state.okuriFeed + (config.setUndoPoint ? undoPoint : "");
      context.preEdit.doKakutei(ret);
      asInputState(state);
      return;
    }
    default:
      console.warn(
        `initializing unknown phase state: ${JSON.stringify(state)}`,
      );
      asInputState(state);
  }
}

export async function henkanInput(context: Context, key: string) {
  kakutei(context, key);
  await handleKey(context, key);
}
