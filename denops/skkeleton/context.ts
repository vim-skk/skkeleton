import type { Denops } from "./deps.ts";
import type { State } from "./state.ts";
import { PreEdit } from "./preedit.ts";
import { romToHira } from "./kana/rom_hira.ts";

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

  toString(): string {
    switch (this.state.type) {
      case "input": {
        const state = this.state;
        let ret = "";
        if (state.mode === "henkan" || state.mode === "okuri") {
          ret = "▽" + state.henkanFeed;
        }
        if (state.mode === "okuri") {
          ret += "*" + state.okuriFeed;
        }
        return ret + state.feed;
      }
      case "escape":
        return "\x1b";
      default:
        return "";
    }
  }
}
