import { config } from "../config.ts";
import { Context } from "../context.ts";
import { assertEquals } from "../deps/std/testing.ts";
import { currentLibrary } from "../jisyo.ts";
import { cancel } from "./common.ts";
import { dispatch } from "./testutil.ts";

currentLibrary.get().registerCandidate("okurinasi", "あ", "い");

Deno.test({
  name: "input cancel",
  async fn() {
    const context = new Context();
    await dispatch(context, "A");
    cancel(context);
    assertEquals(context.toString(), "");
    await dispatch(context, "A ");
    cancel(context);
    assertEquals(context.toString(), "");

    config.immediatelyCancel = false;
    await dispatch(context, "A ");
    cancel(context);
    assertEquals(context.toString(), "▽あ");
    cancel(context);
    assertEquals(context.toString(), "");
  },
});
