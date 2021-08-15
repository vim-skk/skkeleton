import type { Denops } from "./deps.ts";
import type { State } from "./state.ts";
import { PreEdit } from "./preedit.ts";
import { romToHira } from "./table/rom_hira.ts";

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
}
