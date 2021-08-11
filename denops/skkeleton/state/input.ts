import type { Context, InputState } from "../context.ts";

function kakutei(context: Context<InputState>, kana: string, feed: string) {
  context.preEdit.kakutei += kana;
  context.state.feed = feed;
}

export function kanaInput(context: Context<InputState>, char: string) {
  const state = context.state;

  // 「ん」に関するパターンの処理に必要
  const current = state.table.find((e) => e[0] === state.feed);

  state.feed += char;
  const found = state.table.filter(([roman, _]) =>
    roman.startsWith(state.feed)
  );

  if (found.length === 0) {
    if (current) {
      kakutei(context, current[1][0], char);
    } else {
      // kakutei previous feed
      kakutei(context, state.feed, "");
    }
  } else if (found.length === 1 && found[0][0] === state.feed) {
    kakutei(context, found[0][1][0], found[0][1][1]);
  }
}
