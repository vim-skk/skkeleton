import { KanaTable } from "./kana/type.ts";
import type { HenkanType } from "./jisyo.ts";

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
