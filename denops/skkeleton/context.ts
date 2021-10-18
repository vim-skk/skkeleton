import { config } from "./config.ts";
import type { Denops } from "./deps.ts";
import { PreEdit } from "./preedit.ts";
import { initializeState, State } from "./state.ts";

export class Context {
  denops?: Denops;
  state: State = initializeState({});
  mode = "hira";
  preEdit = new PreEdit();
  vimMode = "";

  kakutei(str: string) {
    this.preEdit.doKakutei(str);
  }

  kakuteiWithUndoPoint(str: string) {
    if (config.setUndoPoint && this.vimMode === "i") {
      str += "\x07u";
    }
    this.preEdit.doKakutei(str);
  }

  toString(): string {
    switch (this.state.type) {
      case "input": {
        const state = this.state;
        let ret = "";
        if (state.mode !== "direct") {
          ret = config.markerHenkan + state.henkanFeed;
        }
        if (state.mode === "okuriari") {
          if (state.previousFeed) {
            return ret + state.feed + "*";
          } else {
            ret += "*" + state.okuriFeed;
          }
        }
        if (state.converter) {
          ret = state.converter(ret);
        }
        return ret + state.feed;
      }
      case "henkan": {
        const candidate =
          this.state.candidates[this.state.candidateIndex]?.replace(
            /;.*/,
            "",
          ) ?? "error";
        return config.markerHenkanSelect + candidate + this.state.okuriFeed;
      }
      case "escape":
        return "\x1b";
      default:
        return "";
    }
  }
}
