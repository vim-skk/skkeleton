import { modifyCandidate } from "../candidate.ts";
import { config } from "../config.ts";
import { Context } from "../context.ts";
import { HenkanType } from "../dictionary.ts";
import { initializeStateWithAbbrev } from "../mode.ts";
import { initializeState } from "../state.ts";
import { currentLibrary } from "../store.ts";
import { kakuteiFeed } from "./input.ts";
import { hirakana } from "./mode.ts";

export async function kakutei(context: Context) {
  const state = context.state;
  switch (state.type) {
    case "henkan": {
      const candidate = state.candidates[state.candidateIndex];
      const candidateMod = modifyCandidate(candidate, state.affix);
      if (candidate) {
        const lib = await currentLibrary.get();
        await lib.registerHenkanResult(
          state.mode,
          state.word,
          candidate,
        );
        context.lastCandidate = {
          type: state.mode,
          word: state.word,
          candidate,
        };
      }
      const okuriStr = state.converter
        ? state.converter(state.okuriFeed)
        : state.okuriFeed;
      const ret = (candidateMod ?? "error") + okuriStr;
      context.kakuteiWithUndoPoint(ret);
      break;
    }
    case "input": {
      kakuteiFeed(context);
      let result = state.henkanFeed + state.okuriFeed + state.feed;
      if (state.converter) {
        result = state.converter(result);
      }
      context.kakutei(result);
      break;
    }
    default:
      console.warn(
        `initializing unknown phase state: ${JSON.stringify(state)}`,
      );
  }
  await initializeStateWithAbbrev(context, ["converter", "table"]);
}

// 確定キーの処理には強制的にひらがな入力に戻す物があるが、内部的な確定では必要ないため分けておく
export async function kakuteiKey(context: Context) {
  const { state } = context;
  // 確定する物が無い状態で確定しようとした際にモードを解除する
  // この動作はddskkに存在する
  if (state.type === "input" && state.mode === "direct" && state.feed === "") {
    await hirakana(context);
    return;
  }
  await kakutei(context);
}

export async function newline(context: Context) {
  const insertNewline = !(config.eggLikeNewline &&
    (context.state.type === "henkan" ||
      (context.state.type === "input" && context.state.mode !== "direct")));
  await kakutei(context);
  if (insertNewline) {
    context.kakutei("\n");
  }
}

export function cancel(context: Context) {
  const state = context.state;
  if (
    state.type === "input" &&
    state.mode === "direct" &&
    context.vimMode === "c"
  ) {
    context.kakutei("\x03");
  }
  if (config.immediatelyCancel) {
    initializeState(context.state);
    return;
  }
  switch (state.type) {
    case "input":
      initializeState(state);
      break;
    case "henkan":
      context.state.type = "input";
      break;
  }
}

export async function purgeCandidate(context: Context) {
  const state = context.state;
  let type: HenkanType;
  let word: string;
  let candidate: string;
  if (state.type === "input") {
    type = context.lastCandidate.type;
    word = context.lastCandidate.word;
    candidate = context.lastCandidate.candidate;
  } else if (state.type === "henkan") {
    type = state.mode;
    word = state.word;
    candidate = state.candidates[state.candidateIndex];
  } else {
    console.log("purgeCandidate: reach illegal state");
    console.log(context);
    return;
  }
  if (word === "") {
    return;
  }
  const msg = `Really purge? ${word} /${candidate}/`;
  if (await context.denops!.call("confirm", msg, "&Yes\n&No\n", 2) === 1) {
    const lib = await currentLibrary.get();
    lib.purgeCandidate(type, word, candidate);
    initializeState(state);
    context.lastCandidate.word = "";
  }
}
