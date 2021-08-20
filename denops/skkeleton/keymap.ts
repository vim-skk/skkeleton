import type { Context } from "./context.ts";
import {
  deleteChar,
  henkanPoint,
  inputCancel,
  kanaInput,
} from "./function/input.ts";
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
    "l": disable,
  },
};

const keyMaps: Record<string, KeyMap> = {
  "input": input,
};

export async function handleKey(context: Context, char: string) {
  const keyMap = keyMaps[context.state.type];
  if (!keyMap) {
    throw new Error("Illegal State: " + context.state.type);
  }
  await ((keyMap.map[char] ?? keyMap.default)(context, char) ??
    Promise.resolve());
}
