import { KanaTable } from "./kana/type.ts";

export type State = InputState | EscapeState;

export type InputMode = "direct" | "henkan" | "okuri";

export type InputState = {
  type: "input";
  mode: InputMode;
  table: KanaTable;
  feed: string;
  henkanFeed: string;
  okuriFeed: string;
};

export type EscapeState = {
  type: "escape";
};
