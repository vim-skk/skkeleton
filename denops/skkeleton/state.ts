import { config } from "./config.ts";
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

function inputStateToString(state: InputState): string {
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

export function henkanStateToString(state: HenkanState): string {
  const candidate =
    state.candidates[state.candidateIndex]?.replace(/;.*/, "") ?? "error";
  return config.markerHenkanSelect + candidate + state.okuriFeed;
}

export type EscapeState = {
  type: "escape";
};

export function toString(state: State): string {
  switch (state.type) {
    case "input":
      return inputStateToString(state);
    case "henkan":
      return henkanStateToString(state);
    case "escape":
      return "\x1b";
    default:
      return "";
  }
}
