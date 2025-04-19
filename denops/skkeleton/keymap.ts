import { config } from "./config.ts";
import type { Context } from "./context.ts";
import { Func, functions } from "./function.ts";
import {
  cancel,
  kakuteiKey,
  newline,
  purgeCandidate,
} from "./function/common.ts";
import { escape } from "./function/disable.ts";
import {
  henkanBackward,
  henkanForward,
  henkanInput,
  suffix,
} from "./function/henkan.ts";
import { deleteChar, kanaInput, prefix } from "./function/input.ts";
import { hankatakana } from "./function/mode.ts";
import { notationToKey } from "./notation.ts";

type KeyMap = {
  default: Func;
  map: Record<string, Func>;
};

const input: KeyMap = {
  default: kanaInput,
  map: {
    "<bs>": deleteChar,
    "<c-g>": cancel,
    "<c-h>": deleteChar,
    "<cr>": newline,
    "<esc>": escape,
    "<nl>": kakuteiKey,
    "<c-q>": hankatakana,
    ">": prefix,
  },
};

const henkan: KeyMap = {
  default: henkanInput,
  map: {
    "<c-g>": cancel,
    "<cr>": newline,
    "<nl>": kakuteiKey,
    "<space>": henkanForward,
    "x": henkanBackward,
    "X": purgeCandidate,
    ">": suffix,
  },
};

const keyMaps: Record<string, KeyMap> = {
  "input": input,
  "henkan": henkan,
};

export async function handleKey(context: Context, key: string) {
  const keyMap = keyMaps[context.state.type];
  if (!keyMap) {
    throw new Error("Illegal State: " + context.state.type);
  }
  if (config.debug) {
    console.log(`handleKey: ${key}`);
  }
  await ((keyMap.map[key] ?? keyMap.default)(
    context,
    notationToKey[key] ?? key,
  ) ?? Promise.resolve());
}

export function registerKeyMap(state: string, key: string, func: unknown) {
  if (config.debug) {
    console.log(`registerKeyMap: state = ${state} key = ${key} func = ${func}`);
  }
  const keyMap = keyMaps[state];
  if (!keyMap) {
    throw Error(`unknown state: ${state}`);
  }
  if (!func) {
    delete keyMap.map[key];
    return;
  }
  const fn = functions.get()[String(func)];
  if (!fn) {
    throw Error(`unknown function: ${func}`);
  }
  keyMap.map[key] = fn;
  if (config.debug) {
    console.log(keyMap);
  }
}
