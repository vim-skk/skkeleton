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
  suffix,
} from "./function/henkan.ts";
import {
  deleteChar,
  henkanPoint,
  kakuteiFeed,
  prefix,
} from "./function/input.ts";
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
  kakuteiInput: henkanInput,
  newline,
  cancel,
  purgeCandidate,
  // disable
  disable,
  escape,
  // henkan
  henkanFirst,
  henkanForward,
  henkanBackward,
  henkanInput,
  suffix,
  // input
  kakuteiFeed,
  henkanPoint,
  deleteChar,
  prefix,
  // mode
  abbrev,
  hirakana,
  katakana,
  hankatakana,
  zenkaku,
}));
