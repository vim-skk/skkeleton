import { config } from "../config.ts";
import { Context } from "../context.ts";
import { currentLibrary } from "../jisyo.ts";
import { asInputState } from "../state.ts";
import { undoPoint } from "../util.ts";

export function kakutei(context: Context, _?: string) {
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
    case "input":
      context.preEdit.doKakutei(state.henkanFeed + state.okuriFeed);
      asInputState(state);
      break;
    default:
      console.warn(
        `initializing unknown phase state: ${JSON.stringify(state)}`,
      );
      asInputState(state);
  }
}

export function newline(context: Context) {
  const insertNewline =
    !(config.eggLikeNewline &&
      (context.state.type === "henkan" ||
        (context.state.type === "input" && context.state.mode !== "direct")));
  kakutei(context);
  if (insertNewline) {
    context.preEdit.doKakutei("\n");
  }
}
