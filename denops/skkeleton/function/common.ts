import { config } from "../config.ts";
import { Context } from "../context.ts";
import { currentLibrary } from "../jisyo.ts";
import { asInputState } from "../state.ts";
import { undoPoint } from "../util.ts";
import { kakuteiFeed } from "./input.ts";

export function kakutei(context: Context) {
  const state = context.state;
  switch (state.type) {
    case "henkan": {
      const candidate = state.candidates[state.candidateIndex]?.replace(
        /;.*/,
        "",
      );
      if (candidate) {
        currentLibrary.get().registerCandidate(
          state.mode,
          state.word,
          candidate,
        );
      }
      const ret = (candidate ?? "error") + state.okuriFeed +
        (config.setUndoPoint && context.vimMode === "i" ? undoPoint : "");
      context.preEdit.doKakutei(ret);
      asInputState(state);
      break;
    }
    case "input": {
      kakuteiFeed(context);
      let result = state.henkanFeed + state.okuriFeed;
      if (state.converter) {
        result = state.converter(result);
      }
      context.preEdit.doKakutei(result);
      asInputState(state);
      break;
    }
    default:
      console.warn(
        `initializing unknown phase state: ${JSON.stringify(state)}`,
      );
      asInputState(state);
  }
}

export function newline(context: Context) {
  const insertNewline = !(config.eggLikeNewline &&
    (context.state.type === "henkan" ||
      (context.state.type === "input" && context.state.mode !== "direct")));
  kakutei(context);
  if (insertNewline) {
    context.preEdit.doKakutei("\n");
  }
}

export function cancel(context: Context) {
  if (config.immediatelyCancel) {
    asInputState(context.state);
    return;
  }
  const state = context.state;
  switch (state.type) {
    case "input":
      if (state.mode === "direct" && context.vimMode === "c") {
        console.log("call");
        context.preEdit.doKakutei("\x03");
      }
      asInputState(state);
      break;
    case "henkan":
      context.state.type = "input";
      break;
  }
}
