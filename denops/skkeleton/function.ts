import { Context } from "./context.ts";
import {
  cancel,
  kakuteiKey,
  newline,
  purgeCandidate,
} from "./function/common.ts";
import { disable, escape } from "./function/disable.ts";
import {
  henkanBackward,
  henkanFirst,
  henkanForward,
  henkanInput,
} from "./function/henkan.ts";
import { deleteChar, henkanPoint, kakuteiFeed } from "./function/input.ts";
import {
  abbrev,
  hankatakana,
  hirakana,
  katakana,
  zenkaku,
} from "./function/mode.ts";
import { Cell } from "./util.ts";

export type Func = (
  context: Context,
  char: string,
) => void | Promise<void>;

export const modeFunctions = new Cell<Record<string, Func>>(() => ({
  abbrev: abbrev,
  hankata: hankatakana,
  hira: hirakana,
  kata: katakana,
  zenkaku: zenkaku,
}));

export const functions = new Cell<Record<string, Func>>(() => ({
  // common
  kakutei: kakuteiKey,
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
  hirakana,
  katakana,
  hankatakana,
  zenkaku,
}));
