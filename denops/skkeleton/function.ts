import { Context } from "./context.ts";
import { cancel, kakutei, newline, purgeCandidate } from "./function/common.ts";
import { disable, escape } from "./function/disable.ts";
import {
  henkanBackward,
  henkanFirst,
  henkanForward,
  henkanInput,
} from "./function/henkan.ts";
import { deleteChar, henkanPoint, kakuteiFeed } from "./function/input.ts";
import { abbrev, hankatakana, katakana, zenkaku } from "./function/mode.ts";
import { Cell } from "./util.ts";

export type Func = (
  context: Context,
  char: string,
) => void | Promise<void>;

export const functions = new Cell<Record<string, Func>>(() => ({
  // common
  kakutei,
  newline,
  cancel,
  // disable
  disable,
  escape,
  // henkan
  henkanFirst,
  henkanForward,
  henkanBackward,
  purgeCandidate,
  henkanInput,
  // input
  kakuteiFeed,
  henkanPoint,
  deleteChar,
  // mode
  abbrev,
  katakana,
  hankatakana,
  zenkaku,
}));
