import { modifyCandidate } from "../candidate.ts";
import { config } from "../config.ts";
import type { Context } from "../context.ts";
import { currentLibrary } from "../store.ts";
import { handleKey } from "../keymap.ts";
import { keyToNotation } from "../notation.ts";
import { getOkuriStr } from "../okuri.ts";
import { HenkanState, InputState } from "../state.ts";
import { kakutei } from "./common.ts";
import {
  acceptResult,
  henkanPoint,
  kakuteiFeed,
  kakuteiKana,
  kanaInput,
} from "./input.ts";
import { registerWord } from "./dictionary.ts";

import type { Denops } from "jsr:@denops/std@^7.6.0";

export async function henkanFirst(context: Context, key: string) {
  if (context.state.type !== "input") {
    return;
  }

  if (context.state.mode === "direct") {
    // To prevent the infinite recursive call when henkanFirst itself is registered in rom_kana table.
    const char = config.lowercaseMap[key] ?? key.toLowerCase();
    const state = context.state as InputState;

    const next = state.feed + char;
    const found_next = state.table.filter((e) => e[0].startsWith(next));

    if (
      found_next.length === 1 && found_next[0][0] === next &&
      found_next[0][1] === henkanFirst
    ) {
      context.kakutei(next);
      return;
    } else if (found_next.length === 0 && state.feed) {
      const current = state.table.find((e) => e[0] === state.feed);
      const found_char = state.table.filter((e) => e[0] === char);
      if (current && current[1] === henkanFirst) {
        context.kakutei(current[0]);
        state.feed = "";
      }
      if (
        found_char.length === 1 && found_char[0][0] === char &&
        found_char[0][1] === henkanFirst
      ) {
        if (current) {
          if (current[1] !== henkanFirst) {
            await acceptResult(context, current[1], next);
          }
        } else if (config.acceptIllegalResult) {
          kakuteiKana(state, context.preEdit, state.feed, "");
        } else {
          state.feed = "";
        }
        context.kakutei(char);
        return;
      }
    }

    kanaInput(context, key);
    return;
  }

  kakuteiFeed(context);

  if (context.state.henkanFeed === "") {
    return;
  }

  const state = context.state as unknown as HenkanState;
  state.type = "henkan";
  state.candidates = [];
  state.candidateIndex = -1;

  const lib = await currentLibrary.get();
  const word = state.mode === "okurinasi"
    ? state.henkanFeed
    : getOkuriStr(state.henkanFeed, state.okuriFeed);
  state.word = word;
  if (
    state.affix == null &&
    !state.directInput &&
    ["okurinasi", "okuriari"].includes(state.mode)
  ) {
    // When user maunally uses henkanPoint,
    // henkanFeed like `>prefix` and `suffix>` may
    // reach here with undefined affix
    state.affix = state.henkanFeed.match(">$")
      ? "prefix"
      : state.henkanFeed.match("^>")
      ? "suffix"
      : undefined;
  }
  state.candidates = await lib.getHenkanResult(state.mode, word);
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
    if (await registerWord(context)) {
      return;
    }
    state.candidateIndex = oldCandidateIndex;
    if (state.candidateIndex === -1) {
      context.state.type = "input";
    }
  }
  if (state.candidateIndex >= config.showCandidatesCount) {
    await showCandidates(context.denops!, state);
  }
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

async function showCandidates(denops: Denops, state: HenkanState) {
  const idx = state.candidateIndex;
  const candidates = state.candidates.slice(idx, idx + 7);
  const list = candidates.map((c, i) =>
    `${config.selectCandidateKeys[i]}: ${modifyCandidate(c, state.affix)}`
  );
  await denops.call("skkeleton#popup#open", list);
}

export async function henkanInput(context: Context, key: string) {
  const state = context.state as HenkanState;
  if (state.candidateIndex >= config.showCandidatesCount) {
    const candIdx = config.selectCandidateKeys.indexOf(key);
    if (candIdx !== -1) {
      if (state.candidateIndex + candIdx < state.candidates.length) {
        state.candidateIndex += candIdx;
        await kakutei(context);
      }
      return;
    }
  }

  await kakutei(context);
  await handleKey(context, keyToNotation[key] ?? key);
}

export async function suffix(context: Context) {
  if (context.state.type !== "henkan") {
    return;
  }

  await kakutei(context);
  henkanPoint(context);
  await acceptResult(context, [">", ""], "");
  context.state.affix = "suffix";
}
