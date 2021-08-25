import { Context } from "../context.ts";
import { assertEquals } from "../deps/std/testing.ts";
import { currentLibrary } from "../jisyo.ts";
import { dispatch } from "./testutil.ts";

const l = currentLibrary.get();
l.registerCandidate("okurinasi", "へんかん", "返還");
l.registerCandidate("okurinasi", "へんかん", "変換");
l.registerCandidate("okuriari", "おくr", "送");

Deno.test({
  name: "okurinasi henkan",
  async fn() {
    const context = new Context();
    await dispatch(context, ";henkan ");
    assertEquals(context.toString(), "▼変換");
    await dispatch(context, " ");
    assertEquals(context.toString(), "▼返還");
  },
});

Deno.test({
  name: "okuriari henkan",
  async fn() {
    const context = new Context();
    await dispatch(context, ";oku;ri");
    assertEquals(context.toString(), "▼送り");
  },
});
