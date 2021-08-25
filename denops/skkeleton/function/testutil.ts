import { Context } from "../context.ts";
import { henkanFirst, henkanForward } from "./henkan.ts";
import { henkanPoint, kanaInput } from "./input.ts";

export async function dispatch(context: Context, keys: string) {
  for (const key of keys) {
    switch (key) {
      case " ":
        switch (context.state.type) {
          case "input":
            await henkanFirst(context, key);
            break;
          case "henkan":
            await henkanForward(context, key);
            break;
        }
        break;
      case ";":
        henkanPoint(context, key);
        break;
      default:
        await kanaInput(context, key);
        break;
    }
  }
}
