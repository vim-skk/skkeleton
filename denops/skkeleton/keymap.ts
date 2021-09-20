import { config } from "./config.ts";
import type { Context } from "./context.ts";
import { Func, functions } from "./function.ts";
import { cancel, kakutei, newline } from "./function/common.ts";
import { escape } from "./function/disable.ts";
import {
  henkanBackward,
  henkanFirst,
  henkanForward,
  henkanInput,
} from "./function/henkan.ts";
import { deleteChar, henkanPoint, kanaInput } from "./function/input.ts";
import { katakana } from "./function/mode.ts";
import { keyToNotation, notationToKey } from "./notation.ts";

type KeyMap = {
  default: Func;
  map: Record<string, Func>;
};

const input: KeyMap = {
  default: kanaInput,
  map: {
    ";": henkanPoint,
    "<bs>": deleteChar,
    "<c-g>": cancel,
    "<c-h>": deleteChar,
    "<enter>": newline,
    "<esc>": escape,
    "<nl>": kakutei,
    "<space>": henkanFirst,
    "q": katakana,
  },
};

const henkan: KeyMap = {
  default: henkanInput,
  map: {
    "<c-g>": cancel,
    "<enter>": newline,
    "<nl>": kakutei,
    "<space>": henkanForward,
    "x": henkanBackward,
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
    console.log(`handleKey: key: ${key}, notation: ${keyToNotation[key]}`);
  }
  await ((keyMap.map[keyToNotation[key] ?? key] ?? keyMap.default)(
    context,
    key,
  ) ?? Promise.resolve());
}

export function mappingKey(state: string, key: string, func: string) {
  const keyMap = keyMaps[state];
  if (!keyMap) {
    throw Error(`unknown state: ${state}`);
  }
  const fn = functions.get()[func];
  if (!fn) {
    throw Error(`unknown function: ${func}`);
  }
  if (key === "default") {
    keyMap.default = fn;
  } else {
    const normalizedKey = keyToNotation[notationToKey[key]] ?? key;
    keyMap.map[normalizedKey] = fn;
  }
}
