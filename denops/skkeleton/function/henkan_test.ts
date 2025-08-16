import { Context } from "../context.ts";
import { InputState } from "../state.ts";
import { currentLibrary } from "../store.ts";
import { dispatch } from "./testutil.ts";

import { assertEquals } from "jsr:@std/assert@~1.0.3/equals";

const l = await currentLibrary.get();
await l.registerHenkanResult("okurinasi", "へんかん", "返還");
await l.registerHenkanResult("okurinasi", "へんかん", "変換");
await l.registerHenkanResult("okuriari", "おくr", "送");
await l.registerHenkanResult("okuriari", "えらn", "選");
await l.registerHenkanResult("okuriari", "うたがt", "疑");
await l.registerHenkanResult("okuriari", "うたがc", "疑");

Deno.test({
  name: "okurinasi henkan",
  async fn() {
    const context = new Context();
    await dispatch(context, ";henkan ");
    assertEquals(context.toString(), "▼変換");
    await dispatch(context, " ");
    assertEquals(context.toString(), "▼返還");
    await dispatch(context, "x");
    assertEquals(context.toString(), "▼変換");
  },
});

Deno.test({
  name: "okuriari henkan",
  async fn() {
    {
      const context = new Context();
      await dispatch(context, ";oku;ri");
      assertEquals(context.toString(), "▼送り");
    }
    {
      const context = new Context();
      await dispatch(context, ";era;nde");
      assertEquals(context.toString(), "▼選んで");
    }
    {
      const context = new Context();
      await dispatch(context, ";era;nde");
      assertEquals(context.toString(), "▼選んで");
    }
    {
      const context = new Context();
      await dispatch(context, ";utaga;tte");
      assertEquals(context.toString(), "▼疑って");
    }
    {
      const context = new Context();
      await dispatch(context, ";utaga;ccha");
      assertEquals(context.toString(), "▼疑っちゃ");
    }
  },
});

Deno.test({
  name: "henkan cancel",
  async fn() {
    const context = new Context();
    await dispatch(context, ";henkan x");
    assertEquals(context.toString(), "▽へんかん");
  },
});

Deno.test({
  name: "fallback to kanaInput in henkanFirst",
  async fn() {
    const context = new Context();
    (context.state as InputState).table = [[" ", ["", "space"]]];
    await dispatch(context, " ");
    assertEquals(context.toString(), "space");
    // avoid infinite recursion
    // output key string when result is function
    (context.state as InputState).table = [[" ", () => {
      throw "don't call this";
    }]];
    await dispatch(context, " ");
    assertEquals(context.preEdit.output(""), " ");
  },
});
