import { Context } from "../context.ts";
import { assertEquals } from "../deps/std/testing.ts";
import { currentLibrary } from "../jisyo.ts";
import { henkanFirst, henkanForward } from "./henkan.ts";
import { henkanPoint, kanaInput } from "./input.ts";

const l = currentLibrary.get();
l.registerCandidate("okurinasi", "へんかん", "返還");
l.registerCandidate("okurinasi", "へんかん", "変換");
l.registerCandidate("okuriari", "おくr", "送");

async function input(context: Context, keys: string) {
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

Deno.test({
  name: "okurinasi henkan",
  async fn() {
    const context = new Context();
    await input(context, ";henkan ");
    assertEquals(context.toString(), "▼変換");
    await input(context, " ");
    assertEquals(context.toString(), "▼返還");
  },
});

Deno.test({
  name: "okuriari henkan",
  async fn() {
    const context = new Context();
    await input(context, ";oku;ri");
    assertEquals(context.toString(), "▼送り");
  },
});
