import { config } from "./config.ts";
import { HenkanType } from "./dictionary.ts";
import { PreEdit } from "./preedit.ts";
import { HenkanState, initializeState, State, toString } from "./state.ts";

import type { Denops } from "@denops/std";

type CandidateResult = {
  type: HenkanType;
  word: string;
  candidate: string;
};

// what |skkeleton-functions-kakuteiUndo| needs to take the last kakutei back
type KakuteiResult = {
  // the string the kakutei has inserted into the buffer
  kakutei: string;
  // the henkan state just before the kakutei
  state: HenkanState;
  // the skkeleton mode at the kakutei
  mode: string;
  // where the kakutei has happened
  // the undo deletes the text before the cursor, so it must not fire anywhere
  // else than the place the confirmed string has been written to
  vimMode: string;
  bufnr: number;
  lnum: number;
  // the line before the cursor as it was right after the kakutei
  // used to make sure that the buffer has not been changed since then
  bufferText: string;
};

// a kakutei whose bufferText is not known yet
// the pre-edit is written to the buffer after the key handling has returned,
// so where the cursor ends up is only learned from the prevInput of the next
// key handling
type PendingKakuteiResult = Omit<KakuteiResult, "bufferText">;

export class Context {
  denops?: Denops;
  state: State = initializeState({});
  // g:skkeleton#mode copy
  // set from modeChange()
  mode = "hira"; // state of skkeleton#mode
  preEdit = new PreEdit();
  vimMode = "";
  // where Vim is at the current key handling
  // received from Vim on every handle()
  prevInput = ""; // the line before the cursor
  bufnr = -1;
  lnum = -1;
  lastCandidate: CandidateResult = {
    type: "okurinasi",
    word: "",
    candidate: "",
  };
  lastKakutei: KakuteiResult | undefined;
  pendingKakutei: PendingKakuteiResult | undefined;

  // remember a kakutei so that |skkeleton-functions-kakuteiUndo| can take it
  // back
  // the buffer is only written after this key handling has returned, hence the
  // recording is completed at the next one
  recordKakutei(kakutei: string, state: HenkanState) {
    this.lastKakutei = void 0;
    this.pendingKakutei = {
      kakutei,
      state,
      mode: this.mode,
      vimMode: this.vimMode,
      bufnr: this.bufnr,
      lnum: this.lnum,
    };
  }

  // forget the last kakutei because it can no longer be taken back
  invalidateKakutei() {
    this.lastKakutei = void 0;
    this.pendingKakutei = void 0;
  }

  // complete the kakutei recorded at the previous key handling
  // prevInput has just been received from Vim, so it tells where the kakutei
  // has left the cursor
  // returns whether the buffer has been rewritten by a kakutei skkeleton knows
  // about, which is what explains a mismatch against the pre-edit
  resolvePendingKakutei(): boolean {
    const pending = this.pendingKakutei;
    if (!pending) {
      return false;
    }
    this.pendingKakutei = void 0;
    if (!this.#isAt(pending) || !this.prevInput.endsWith(pending.kakutei)) {
      return false;
    }
    this.lastKakutei = { ...pending, bufferText: this.prevInput };
    return true;
  }

  // the kakutei which can be taken back right now, if any
  takeBackableKakutei(): KakuteiResult | undefined {
    const last = this.lastKakutei;
    if (
      !last || !this.#isAt(last) || this.prevInput !== last.bufferText ||
      // Note: a key handled before this one within the same handling has
      //       written to the buffer already, which prevInput cannot know yet
      //       (|skkeleton#handle()| takes a list of keys)
      this.preEdit.dirty
    ) {
      return void 0;
    }
    return last;
  }

  // whether Vim is still where the kakutei has happened
  #isAt(at: PendingKakuteiResult): boolean {
    return this.vimMode === at.vimMode && this.bufnr === at.bufnr &&
      this.lnum === at.lnum;
  }

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
