import { KanaTable } from "./kana/type.ts";

export type State = InputState
 
export type InputState = {
  type: "input";
  mode: "direct" | "henkan" | "okuri";
  table: KanaTable;
  feed: string;
  henkanFeed: string;
  okuriFeed: string;
}
