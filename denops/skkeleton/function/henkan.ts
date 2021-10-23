import { config } from "../config.ts";
import type { Context } from "../context.ts";
import type { Denops } from "../deps.ts";
import { currentLibrary } from "../jisyo.ts";
import { handleKey } from "../keymap.ts";
import { getOkuriStr } from "../okuri.ts";
import type { HenkanState } from "../state.ts";
import { kakutei } from "./common.ts";
import { kakuteiFeed } from "./input.ts";
import { jisyoTouroku } from "./jisyo.ts";

export async function henkanFirst(context: Context, key: string) {
  if (context.state.type !== "input") {
    return;
  }

  kakuteiFeed(context);

  if (context.state.mode === "direct") {
    context.kakutei(key);
    return;
  }

  const state = context.state as unknown as HenkanState;
  state.type = "henkan";
  state.candidates = [];
  state.candidateIndex = -1;

  const lib = currentLibrary.get();
  if (config.immediatelyJisyoRW) {
    await lib.loadJisyo();
  }
  const word = state.mode === "okurinasi"
    ? state.henkanFeed
    : getOkuriStr(state.henkanFeed, state.okuriFeed);
  state.word = word;
  state.candidates = await lib.getCandidate(state.mode, word);
  await henkanForward(context);
}

export async function henkanForward(context: Context) {
  const state = context.state;
  if (state.type !== "henkan") {
    return;
  }
  const oldCandidateIndex = state.candidateIndex;
  if (state.candidateIndex >= config.showCandidatesCount) {
    state.candidateIndex += 7;
  } else {
    state.candidateIndex++;
  }
  if (state.candidates.length <= state.candidateIndex) {
    if (await jisyoTouroku(context)) {
      return;
    }
    state.candidateIndex = oldCandidateIndex;
    if (state.candidateIndex === -1) {
      context.state.type = "input";
    }
  }
  if (state.candidateIndex >= config.showCandidatesCount) {
    if (config.usePopup && context.vimMode === "i") {
      await showCandidates(context.denops!, state);
    } else {
      await selectCandidates(context);
    }
  }
  await Promise.resolve();
}

export async function henkanBackward(context: Context) {
  const state = context.state;
  if (state.type !== "henkan") {
    return;
  }
  if (state.candidateIndex >= config.showCandidatesCount) {
    state.candidateIndex = Math.max(
      state.candidateIndex - 7,
      config.showCandidatesCount - 1,
    );
  } else {
    state.candidateIndex--;
  }
  if (state.candidateIndex < 0) {
    context.state.type = "input";
    return;
  }
  if (state.candidateIndex >= config.showCandidatesCount) {
    await showCandidates(context.denops!, state);
  }
}

async function selectCandidates(context: Context) {
  const state = context.state as HenkanState;
  const denops = context.denops!;
  await Promise.resolve();
  const count = config.showCandidatesCount;
  const keys = config.selectCandidateKeys;
  let index = 0;
  while (index >= 0) {
    const start = count + index * keys.length;
    if (start >= state.candidates.length) {
      if (await jisyoTouroku(context)) {
        return;
      }
    }
    const candidates = state.candidates.slice(start, start + keys.length);
    const msg = candidates.map((c, i) => `${keys[i]}: ${c.replace(/;.*/, "")}`)
      .join(" ");
    const keyCode = await denops.call("skkeleton#getchar", msg) as number;
    const key = String.fromCharCode(keyCode);
    if (key === " ") {
      index += 1;
    } else if (key === "x") {
      index -= 1;
    } else {
      const candIndex = keys.indexOf(key);
      if (candIndex !== -1) {
        state.candidateIndex = start + candIndex;
        kakutei(context);
        return;
      }
    }
  }
}

async function showCandidates(denops: Denops, state: HenkanState) {
  const idx = state.candidateIndex;
  const candidates = state.candidates.slice(idx, idx + 7);
  const list = candidates.map((c, i) =>
    `${config.selectCandidateKeys[i]}: ${c.replace(/;.*/, "")}`
  );
  await denops.call("skkeleton#show_candidates", list);
}

export async function henkanInput(context: Context, key: string) {
  const state = context.state as HenkanState;
  await context.denops!.call("skkeleton#close_candidates");
  if (state.candidateIndex >= config.showCandidatesCount) {
    const candIdx = config.selectCandidateKeys.indexOf(key);
    if (candIdx !== -1) {
      state.candidateIndex += candIdx;
      kakutei(context);
      return;
    }
  }

  kakutei(context);
  await handleKey(context, key);
}
