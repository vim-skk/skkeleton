import { config } from "./config.ts";
import { Context } from "./context.ts";
import { assertEquals } from "./deps/std/testing.ts";
import { dispatch } from "./function/testutil.ts";
import { currentLibrary } from "./store.ts";

const defaultConfig = { ...config };

const lib = await currentLibrary.get();
lib.registerCandidate("okurinasi", "あ", "あ");

Deno.test({
  name: "egg like newline",
  async fn() {
    Object.assign(config, defaultConfig);
    const context = new Context();
    // normal
    await dispatch(context, "A \nA\n");
    assertEquals(context.preEdit.output(""), "あ\nあ\n");
    // egg like
    config.eggLikeNewline = true;
    await dispatch(context, "A \nA\n");
    assertEquals(context.preEdit.output(""), "ああ");
  },
});

Deno.test({
  name: "acceptIllegalResult",
  async fn() {
    {
      config.acceptIllegalResult = false;
      const context = new Context();
      await dispatch(context, "ksa");
      assertEquals(context.preEdit.output(""), "さ");
    }
    {
      config.acceptIllegalResult = true;
      const context = new Context();
      await dispatch(context, "ksa");
      assertEquals(context.preEdit.output(""), "kさ");
    }
  },
});
