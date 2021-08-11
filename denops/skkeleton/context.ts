import { PreEdit } from "./preedit.ts";
import { SKKTable } from "./table/type.ts";
import { romToHira } from "./table/rom_hira.ts";

export type Context<T extends State> = {
  state: T;
  preEdit: PreEdit;
}

export function newContext(): Context<State> {
  return {
    state: {
      type: "input",
      mode: "direct",
      table: romToHira,
      feed: "",
      henkanFeed: [],
    },
    preEdit: new PreEdit(),
  };
}

export type State = InputState
 
export type InputState = {
  type: "input";
  mode: "direct" | "henkan";
  table: SKKTable;
  feed: string;
  henkanFeed: string[];
};
