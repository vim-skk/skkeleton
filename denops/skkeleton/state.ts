import { KanaTable } from "./kana/type.ts";
import type { HenkanType } from "./jisyo.ts";
import { getKanaTable } from "./kana.ts";

export type State = InputState | HenkanState | EscapeState;

export type InputMode = "direct" | "henkan" | "okuri";

export type InputState = {
  type: "input";
  mode: InputMode;
  table: KanaTable;
  feed: string;
  henkanFeed: string;
  okuriFeed: string;
};

export function asInputState(astate: State, initialize = true): InputState {
  const state = astate as InputState;
  state.type = "input";
  if (initialize) {
    state.table = getKanaTable();
    state.mode = "direct";
    state.feed = "";
    state.henkanFeed = "";
    state.okuriFeed = "";
  } else {
    state.table ??= getKanaTable();
    state.mode ??= "direct";
    state.feed ??= "";
    state.henkanFeed ??= "";
    state.okuriFeed ??= "";
  }
  return state;
}

export type HenkanState = {
  type: "henkan";
  mode: HenkanType;
  henkanFeed: string;
  okuriFeed: string;
  candidates: string[];
  candidateIndex: number;
};

export type EscapeState = {
  type: "escape";
};
