import { Context } from "../context.ts";
import {
  henkanBackward,
  henkanFirst,
  henkanForward,
  newline,
} from "./henkan.ts";
import { henkanPoint, insertRaw, kanaInput } from "./input.ts";

export async function dispatch(context: Context, keys: string) {
  for (const key of keys) {
    switch (context.state.type) {
      case "input":
        switch (key) {
          case " ":
            await henkanFirst(context, key);
            break;
          case ";":
            henkanPoint(context, key);
            break;
          case "\n":
            insertRaw(context, "\n");
            break;
          default:
            await kanaInput(context, key);
        }
        break;
      case "henkan":
        switch (key) {
          case " ":
            await henkanForward(context, key);
            break;
          case "x":
            await henkanBackward(context, key);
            break;
          case "\n":
            newline(context);
            break;
        }
        break;
    }
  }
}
