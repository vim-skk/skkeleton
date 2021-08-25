import { config } from "../config.ts";
import type { Context } from "../context.ts";
import { fn } from "../deps.ts";
import type { Denops } from "../deps.ts";
import { currentLibrary } from "../jisyo.ts";
import { handleKey } from "../keymap.ts";
import { getOkuriStr } from "../okuri.ts";
import { asInputState } from "../state.ts";
import type { HenkanState } from "../state.ts";
import { undoPoint } from "../util.ts";

export async function henkanFirst(context: Context, key: string) {
  if (context.state.type !== "input") {
    return;
  }

  const inputState = context.state;

  if (inputState.mode === "direct") {
    context.preEdit.doKakutei(key);
    return;
  }

  const feed = inputState.feed;
  const queueAsKana = inputState.table.find((e) => e[0] === feed)?.[1][0];
  if (queueAsKana) {
    switch (inputState.mode) {
      case "okurinasi":
        inputState.henkanFeed += queueAsKana;
        break;
      case "okuriari":
        inputState.okuriFeed += queueAsKana;
        break;
    }
  }

  const state = context.state as unknown as HenkanState;
  state.type = "henkan";
  state.candidates = [];
  state.candidateIndex = -1;

  const lib = currentLibrary.get();
  const word = state.mode === "okurinasi"
    ? state.henkanFeed
    : getOkuriStr(state.henkanFeed, state.okuriFeed);
  state.candidates = lib.getCandidates(state.mode, word);
  await henkanForward(context, key);
}

export async function henkanForward(context: Context, _?: string) {
  const state = context.state;
  if (state.type !== "henkan") {
    return;
  }
  if (state.candidateIndex >= config.showCandidatesCount) {
    state.candidateIndex += 7;
  } else {
    state.candidateIndex++;
  }
  if (state.candidates.length <= state.candidateIndex) {
    // TODO: 辞書登録
    return;
  }
  if (state.candidateIndex >= config.showCandidatesCount) {
    if (config.usePopup && await fn.mode(context.denops!) === "i") {
      await showCandidates(context.denops!, state);
    } else {
      await selectCandidates(context);
    }
  }
  await Promise.resolve();
}

export async function henkanBackward(context: Context, _?: string) {
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
    // TODO: 戻す
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
      // TODO: 辞書登録
      throw new Error("jisyo touroku");
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
        kakutei(context, key);
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

export function kakutei(context: Context, _?: string) {
  const state = context.state;
  switch (state.type) {
    case "henkan": {
      const candidate =
        state.candidates[state.candidateIndex]?.replace(/;.*/, "") ?? "error";
      const ret = candidate + state.okuriFeed +
        (config.setUndoPoint ? undoPoint : "");
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

  kakutei(context, key);
  await handleKey(context, key);
}
