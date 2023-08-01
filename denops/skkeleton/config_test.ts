import { config } from "./config.ts";
import { Context } from "./context.ts";
import { assertEquals } from "./deps/std/testing.ts";
import { dispatch } from "./function/testutil.ts";
import { currentLibrary } from "./store.ts";

const defaultConfig = { ...config };

const lib = await currentLibrary.get();
lib.registerCandidate("okurinasi", "あ", "あ");
lib.registerCandidate("okuriari", "あt", "会");
lib.registerCandidate("okuriari", "すp", "酸");

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

Deno.test({
  name: "immediatelyOkuriConvert",
  async fn() {
    // true
    {
      Object.assign(config, defaultConfig);
      const context = new Context();
      await dispatch(context, ";a;xtu");
      assertEquals(context.toString(), "▼会っ");
    }
    // false
    {
      config.immediatelyOkuriConvert = false;
      const context = new Context();
      await dispatch(context, ";su;xtupa");
      assertEquals(context.toString(), "▼酸っぱ");
    }
  },
});
