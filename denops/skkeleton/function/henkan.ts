import type { Context } from "../context.ts";
import { getOkuriStr } from "../okuri.ts";
import type { HenkanState } from "../state.ts";
import { currentLibrary } from "../jisyo.ts";
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
  if(state.type !== "henkan") {
    return;
  }
  state.candidateIndex++;
  if(state.candidates.length <= state.candidateIndex) {
    // TODO: 辞書登録
  }
  await Promise.resolve();
}

export async function henkanBackward(context: Context, _?: string) {
  const state = context.state;
  if(state.type !== "henkan") {
    return;
  }
  await Promise.resolve();
}
