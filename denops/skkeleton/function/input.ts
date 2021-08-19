import type { Context } from "../context.ts";
import type { PreEdit } from "../preedit.ts";
import type { InputState } from "../state.ts";

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
      state.okuriFeed += kana;
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
