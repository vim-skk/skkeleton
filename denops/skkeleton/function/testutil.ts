import { Context } from "../context.ts";
import { Denops } from "../deps.ts";
import { fromFileUrl } from "../deps/std/path.ts";
import { main } from "../main.ts";
import { newline } from "./common.ts";
import { henkanBackward, henkanFirst, henkanForward } from "./henkan.ts";
import { henkanPoint, kanaInput } from "./input.ts";

export async function initDenops(denops: Denops) {
  const p = fromFileUrl(new URL(import.meta.url));
  const autoload = p.slice(0, p.lastIndexOf("denops")) +
    "autoload/skkeleton.vim";
  await denops.cmd("source " + autoload);
  await main(denops);
}

export async function dispatch(context: Context, keys: string) {
  for (const key of keys) {
    switch (context.state.type) {
      case "input":
        switch (key) {
          case " ":
            await henkanFirst(context, key);
            break;
          case ";":
            henkanPoint(context);
            break;
          case "\n":
            newline(context);
            break;
          default:
            await kanaInput(context, key);
        }
        break;
      case "henkan":
        switch (key) {
          case " ":
            await henkanForward(context);
            break;
          case "x":
            await henkanBackward(context);
            break;
          case "\n":
            newline(context);
            break;
        }
        break;
    }
  }
}
