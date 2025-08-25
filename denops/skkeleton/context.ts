import { config } from "./config.ts";
import { HenkanType } from "./dictionary.ts";
import { PreEdit } from "./preedit.ts";
import { initializeState, State, toString } from "./state.ts";

import type { Denops } from "@denops/std";

type CandidateResult = {
  type: HenkanType;
  word: string;
  candidate: string;
};

export class Context {
  denops?: Denops;
  state: State = initializeState({});
  // g:skkeleton#mode copy
  // set from modeChange()
  mode = "hira"; // state of skkeleton#mode
  preEdit = new PreEdit();
  vimMode = "";
  lastCandidate: CandidateResult = {
    type: "okurinasi",
    word: "",
    candidate: "",
  };

  kakutei(str: string) {
    this.preEdit.doKakutei(str);
  }

  kakuteiWithUndoPoint(str: string) {
    if (config.setUndoPoint && this.vimMode === "i") {
      str += "\x07u";
    }
    this.preEdit.doKakutei(str);
  }

  toString() {
    return toString(this.state);
  }
}
