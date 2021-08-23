import type { Context } from "./context.ts";
import {
  deleteChar,
  henkanPoint,
  inputCancel,
  kanaInput,
} from "./function/input.ts";
import {
  henkanFirst,
  henkanForward,
  henkanBackward,
} from "./function/henkan.ts";
import { disable, escape } from "./function/disable.ts";

type KeyHandler = (context: Context, char: string) => void | Promise<void>;

type KeyMap = {
  default: KeyHandler;
  map: Record<string, KeyHandler>;
};

const input: KeyMap = {
  default: kanaInput,
  map: {
    ";": henkanPoint,
    "<BS>": deleteChar,
    "<C-g>": inputCancel,
    "<C-h>": deleteChar,
    "<Esc>": escape,
    "<Space>": henkanFirst,
    "l": disable,
  },
};

const henkan: KeyMap = {
  default: kanaInput,
  map: {
    " ": henkanForward,
    "x": henkanBackward,
  },
};

const keyMaps: Record<string, KeyMap> = {
  "input": input,
  "henkan": henkan,
};

export async function handleKey(context: Context, keyNotation: string, key: string) {
  const keyMap = keyMaps[context.state.type];
  if (!keyMap) {
    throw new Error("Illegal State: " + context.state.type);
  }
  await ((keyMap.map[keyNotation] ?? keyMap.default)(context, key) ??
    Promise.resolve());
}
