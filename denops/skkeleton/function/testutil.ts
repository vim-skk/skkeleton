import { Context } from "../context.ts";
import { henkanFirst, henkanForward } from "./henkan.ts";
import { henkanPoint, kanaInput } from "./input.ts";

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
          default:
            kanaInput(context, key);
        }
        break;
      case "henkan":
        switch (key) {
        case " ":
          await henkanForward(context, key);
        }
        break;
    }
  }
}
