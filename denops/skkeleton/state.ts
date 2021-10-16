import type { HenkanType } from "./jisyo.ts";
import { getKanaTable } from "./kana.ts";
import { KanaTable } from "./kana/type.ts";

export type State = InputState | HenkanState | EscapeState;

export type InputMode = "direct" | HenkanType;

export type InputState = {
  type: "input";
  mode: InputMode;
  table: KanaTable;
  converter?: (input: string) => string;
  converterName: string;
  feed: string;
  henkanFeed: string;
  okuriFeed: string;
  // かなフィードが変換ポイントの前にあるかどうか
  // 「察し」などを変換するのに必要
  previousFeed: boolean;
};

const defaultInputState: InputState = {
  type: "input",
  mode: "direct",
  table: getKanaTable(),
  converter: void 0,
  converterName: "",
  feed: "",
  henkanFeed: "",
  okuriFeed: "",
  previousFeed: false,
};

export function initializeState(state: Record<string, unknown>): InputState {
  defaultInputState.table = getKanaTable();
  return Object.assign(state, defaultInputState);
}

export function resetState(astate: State) {
  astate.type = "input";
  const state = astate as InputState;
  state.mode = "direct";
  state.feed = "";
  state.henkanFeed = "";
  state.okuriFeed = "";
  state.previousFeed = false;
}

export type HenkanState = Omit<InputState, "type"> & {
  type: "henkan";
  mode: HenkanType;
  word: string;
  candidates: string[];
  candidateIndex: number;
};

export type EscapeState = {
  type: "escape";
};
