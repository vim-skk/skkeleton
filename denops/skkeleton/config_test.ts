import { config } from "./config.ts";
import { Context } from "./context.ts";
import { Denops } from "./deps.ts";
import { disable } from "./function/disable.ts";
import { katakana } from "./function/mode.ts";
import { dispatch } from "./function/testutil.ts";
import { currentContext, currentLibrary, variables } from "./store.ts";
import { test } from "./testutil.ts";

import { assertEquals } from "jsr:@std/assert@~1.0.3/equals";

const defaultConfig = { ...config };

const lib = await currentLibrary.get();
lib.registerHenkanResult("okurinasi", "あ", "あ");
lib.registerHenkanResult("okuriari", "あt", "会");
lib.registerHenkanResult("okuriari", "すp", "酸");

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

test({
  mode: "all",
  name: "keepMode",
  async fn(d: Denops) {
    config.keepMode = true;
    variables.lastMode = "hira";
    const context = currentContext.get();
    await d.call("skkeleton#handle", "enable", {});
    await katakana(context);
    await disable(context);
    await d.call("skkeleton#handle", "enable", {});
    assertEquals(currentContext.get().mode, "kata");
  },
});
