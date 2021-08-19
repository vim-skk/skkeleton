import { KanaTable } from "./kana/type.ts";

export type State = InputState | AState
 
export type InputState = {
  type: "input";
  mode: "direct" | "henkan" | "okuri";
  table: KanaTable;
  feed: string;
  henkanFeed: string;
  okuriFeed: string;
}

// 型検査のチェック用ダミーステート
export type AState = {
  type: "a"
}
