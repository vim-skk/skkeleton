import { config } from "../config.ts";
import { kakutei } from "./common.ts";
import type { Context } from "../context.ts";
import { KanaResult } from "../kana/type.ts";
import { PreEdit } from "../preedit.ts";
import { InputState } from "../state.ts";
import { henkanFirst } from "./henkan.ts";
import { initializeStateWithAbbrev } from "../mode.ts";

// feedが仮名に変換できる場合は確定
export function kakuteiFeed(context: Context) {
  if (context.state.type !== "input") {
    return;
  }
  const inputState = context.state;
  const feed = inputState.feed;
  const queueAsKana = inputState.table.find((e) => e[0] === feed)?.[1];
  if (Array.isArray(queueAsKana)) {
    kakuteiKana(inputState, context.preEdit, queueAsKana[0], "");
  }
}

export function kakuteiKana(
  state: InputState,
  preEdit: PreEdit,
  kana: string,
  feed: string,
) {
  switch (state.mode) {
    case "direct":
      if (state.converter) {
        kana = state.converter(kana);
      }
      preEdit.doKakutei(kana);
      break;
    case "okurinasi":
      state.henkanFeed += kana;
      break;
    case "okuriari":
      if (feed && state.previousFeed) {
        state.henkanFeed += kana;
      } else {
        state.okuriFeed += kana;
      }
      state.previousFeed = false;
      break;
  }
  state.feed = feed;
}

async function doKakutei(
  context: Context,
  kana: string,
  feed: string,
) {
  const { preEdit, state } = context;
  if (state.type !== "input") {
    return;
  }
  kakuteiKana(state, preEdit, kana, feed);
  if (state.mode === "okuriari" && feed === "") {
    if (state.okuriFeed.at(-1) === "っ") {
      // immediatelyOkuriConvertが有効になっていない場合
      // 直接入力などで「使った」のように打つ時「つかっ」の段階では変換をしない
      if (config.immediatelyOkuriConvert) {
        await henkanFirst(context, "");
      }
    } else {
      await henkanFirst(context, "");
    }
  }
}

async function acceptResult(
  context: Context,
  result: KanaResult,
  feed: string,
) {
  if (Array.isArray(result)) {
    await doKakutei(context, result[0], result[1]);
  } else {
    const state = context.state as InputState;
    state.feed = "";
    await result(context, feed);
  }
}

export async function kanaInput(context: Context, char: string) {
  context.state.type = "input";
  const state = context.state as InputState;

  const lower = char.toLowerCase();
  if (!state.directInput && char !== lower) {
    const withShift = `<s-${lower}>`;
    if (state.table.some((e) => e[0].startsWith(state.feed + withShift))) {
      char = withShift;
    } else {
      henkanPoint(context);
      await kanaInput(context, lower);
      return;
    }
  }

  const next = state.feed + char;
  const found = state.table.filter((e) => e[0].startsWith(next));

  if (found.length === 1 && found[0][0] === next) {
    // 正確にマッチした場合はそのまま確定
    await acceptResult(context, found[0][1], next);
  } else if (found.length) {
    // テーブルに残余があったらfeedに積む
    state.feed = next;
  } else if (state.feed) {
    // テーブルとマッチせずfeedが存在した場合は
    // feedを確定し、もう一度kanaInputに通す
    const current = state.table.find((e) => e[0] === state.feed);
    if (current) {
      await acceptResult(context, current[1], next);
    } else if (config.acceptIllegalResult) {
      kakuteiKana(state, context.preEdit, state.feed, "");
    } else {
      state.feed = "";
    }
    await kanaInput(context, char);
  } else {
    // feedが無い場合(=テーブルに存在しない文字)
    // そのまま確定してしまう
    kakuteiKana(state, context.preEdit, char, "");
  }
}

export function henkanPoint(context: Context) {
  if (context.state.type !== "input") {
    return;
  }
  const state = context.state;
  const found = state.table.filter((e) => e[0].startsWith(state.feed));
  // don't transition to okuri mode when henkan str is empty
  if (state.mode === "okurinasi" && state.henkanFeed.length === 0) {
    return;
  }
  switch (state.mode) {
    case "direct":
      if (found.length === 0) {
        context.kakutei(state.feed);
        state.feed = "";
      }
      context.kakuteiWithUndoPoint("");
      state.mode = "okurinasi";
      break;
    case "okurinasi":
      if (state.feed === "" || found.length === 0) {
        state.feed = "";
      } else if (found[0][0] === state.feed) {
        const result = found[0][1];
        if (Array.isArray(result)) {
          state.henkanFeed += result[0];
        }
        state.feed = "";
      } else {
        state.previousFeed = true;
      }
      state.mode = "okuriari";
  }
}

export async function deleteChar(context: Context) {
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
      await initializeStateWithAbbrev(context, ["converter"]);
    }
  } else {
    context.kakutei("\b");
  }
}

export async function affix(context: Context, key: string) {
  // prefix
  if (
    context.state.type === "input" &&
    !context.state.directInput &&
    context.state.henkanFeed.length > 0 &&
    ["okurinasi", "okuriari"].includes(context.state.mode)
  ) {
    await acceptResult(context, [">", ""], "");
    await henkanFirst(context, key);
    return;
  }

  // suffix
  if (context.state.type == "henkan") {
    await kakutei(context);
    henkanPoint(context);
    await acceptResult(context, [">", ""], "");
    return;
  }

  // non-affix
  await kanaInput(context, key);
}
