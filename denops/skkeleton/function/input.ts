import { config } from "../config.ts";
import type { Context } from "../context.ts";
import { hiraToKata } from "../kana/hira_kata.ts";
import { asInputState } from "../state.ts";
import type { InputMode, InputState } from "../state.ts";
import { undoPoint } from "../util.ts";
import { henkanFirst } from "./henkan.ts";

async function kakutei(
  context: Context,
  kana: string,
  feed: string,
) {
  const { preEdit, state } = context;
  if (state.type !== "input") {
    return;
  }
  switch (state.mode) {
    case "direct":
      preEdit.doKakutei(kana);
      break;
    case "okurinasi":
      state.henkanFeed += kana;
      break;
    case "okuriari":
      state.okuriFeed += kana;
      if (feed) {
        state.feed += kana;
      } else {
        state.feed = "";
        await henkanFirst(context, "");
      }
      break;
  }
  state.feed = feed;
}

export async function kanaInput(context: Context, char: string) {
  // TODO: as InputState
  const state = context.state as InputState;

  // 「ん」に関するパターンの処理に必要
  const current = state.table.find((e) => e[0] === state.feed);

  const previousFeed = state.feed;
  state.feed += char;
  const found = state.table.filter((e) => e[0].startsWith(state.feed));

  if (found.length === 0) {
    if (current) {
      await kakutei(context, current[1][0], char);
    } else {
      // kakutei previous feed
      await kakutei(context, previousFeed, char);
    }
  } else if (found.length === 1 && found[0][0] === state.feed) {
    await kakutei(context, found[0][1][0], found[0][1][1]);
  }
}

const henkanPointTransition: Record<string, InputMode> = {
  "direct": "okurinasi",
  "okurinasi": "okuriari",
  "okuriari": "okuriari",
};

export function henkanPoint(context: Context, _?: string) {
  // TODO: ちゃんと確定する
  if (context.state.type !== "input") {
    return;
  }
  const state = context.state;
  if (state.mode === "direct" && config.setUndoPoint) {
    context.preEdit.doKakutei(undoPoint);
  }
  // don't transition to okuri mode when henkan str is empty
  if (state.mode === "okurinasi" && state.henkanFeed.length === 0) {
    return;
  }
  state.mode = henkanPointTransition[state.mode];
}

export function deleteChar(context: Context, _?: string) {
  if (context.state.type !== "input") {
    return;
  }
  const state = context.state;
  if (state.feed) {
    state.feed = state.feed.slice(0, -1);
  } else if (state.mode === "okuriari") {
    if (state.okuriFeed) {
      state.okuriFeed = state.okuriFeed.slice(0, -1);
    } else {
      state.mode = "okurinasi";
    }
  } else if (state.mode === "okurinasi") {
    if (state.henkanFeed) {
      state.henkanFeed = state.henkanFeed.slice(0, -1);
    } else {
      state.mode = "direct";
    }
  } else {
    context.preEdit.doKakutei("\b");
  }
}

export function katakana(context: Context, _?: string) {
  if (context.state.type !== "input") {
    return;
  }
  const state = context.state;
  if (state.mode === "direct") {
    // TODO: change to katakana mode
    return;
  }
  const result = hiraToKata(state.henkanFeed + state.okuriFeed);
  context.preEdit.doKakutei(result);
  asInputState(state);
}

export function inputCancel(context: Context, _?: string) {
  const state = context.state;
  if (state.type !== "input") {
    return;
  }
  state.mode = "direct";
  state.feed = "";
  state.henkanFeed = "";
  state.okuriFeed = "";
}
