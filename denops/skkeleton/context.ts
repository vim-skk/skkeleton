import type { Denops } from "./deps.ts";
import { getKanaTable } from "./kana.ts";
import { PreEdit } from "./preedit.ts";
import type { State } from "./state.ts";
import { config } from "./config.ts";

export class Context {
  denops?: Denops;
  state: State = {
    type: "input",
    mode: "direct",
    table: getKanaTable(),
    tableName: "hira",
    converterName: "",
    feed: "",
    henkanFeed: "",
    okuriFeed: "",
    previousFeed: false,
  };
  preEdit = new PreEdit();
  vimMode = "";

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
