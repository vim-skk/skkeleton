import type { Context } from "../context.ts";
import type { PreEdit } from "../preedit.ts";
import type { InputMode, InputState } from "../state.ts";
import { config } from "../config.ts";
import { undoPoint } from "../util.ts";

function kakutei(
  preEdit: PreEdit,
  state: InputState,
  kana: string,
  feed: string,
) {
  switch (state.mode) {
    case "direct":
      preEdit.doKakutei(kana);
      break;
    case "henkan":
      state.henkanFeed += kana;
      break;
    case "okuri":
      if (feed) {
        state.okuriFeed += kana;
      } else {
        // TODO: 変換を行う
      }
      break;
  }
  state.feed = feed;
}

export function kanaInput(context: Context, char: string) {
  // TODO: as InputState
  const state = context.state as InputState;

  // 「ん」に関するパターンの処理に必要
  const current = state.table.find((e) => e[0] === state.feed);

  state.feed += char;
  const found = state.table.filter((e) => e[0].startsWith(state.feed));

  if (found.length === 0) {
    if (current) {
      kakutei(context.preEdit, state, current[1][0], char);
    } else {
      // kakutei previous feed
      kakutei(context.preEdit, state, state.feed, "");
    }
  } else if (found.length === 1 && found[0][0] === state.feed) {
    kakutei(context.preEdit, state, found[0][1][0], found[0][1][1]);
  }
}

const henkanPointTransition: Record<string, InputMode> = {
  "direct": "henkan",
  "henkan": "okuri",
  "okuri": "okuri",
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
  if (state.mode === "henkan" && state.henkanFeed.length === 0) {
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
  } else if (state.mode === "okuri") {
    if (state.okuriFeed) {
      state.okuriFeed = state.okuriFeed.slice(0, -1);
    } else {
      state.mode = "henkan";
    }
  } else if (state.mode === "henkan") {
    if (state.henkanFeed) {
      state.henkanFeed = state.henkanFeed.slice(0, -1);
    } else {
      state.mode = "direct";
    }
  } else {
    context.preEdit.doKakutei("\b");
  }
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
