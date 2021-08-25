import type { Denops } from "./deps.ts";
import { romToHira } from "./kana/rom_hira.ts";
import { PreEdit } from "./preedit.ts";
import type { State } from "./state.ts";

export class Context {
  denops?: Denops;
  state: State = {
    type: "input",
    mode: "direct",
    table: romToHira,
    feed: "",
    henkanFeed: "",
    okuriFeed: "",
  };
  preEdit = new PreEdit();
  vimMode = "";

  toString(): string {
    switch (this.state.type) {
      case "input": {
        const state = this.state;
        let ret = "";
        if (state.mode === "okurinasi" || state.mode === "okuriari") {
          ret = "▽" + state.henkanFeed;
        }
        if (state.mode === "okuriari") {
          ret += "*" + state.okuriFeed;
        }
        return ret + state.feed;
      }
      case "henkan": {
        const candidate =
          this.state.candidates[this.state.candidateIndex]?.replace(
            /;.*/,
            "",
          ) ?? "error";
        return "▼" + candidate + this.state.okuriFeed;
      }
      case "escape":
        return "\x1b";
      default:
        return "";
    }
  }
}
