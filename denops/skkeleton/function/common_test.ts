import { config } from "../config.ts";
import { Context } from "../context.ts";
import { assertEquals } from "../deps/std/assert.ts";
import { currentLibrary } from "../store.ts";
import { cancel, kakutei } from "./common.ts";
import { katakana } from "./mode.ts";
import { dispatch } from "./testutil.ts";

const lib = await currentLibrary.get();

await lib.registerHenkanResult("okurinasi", "あ", "い");
await lib.registerHenkanResult(
  "okurinasi",
  "ちゅうしゃく",
  "注釈;これは注釈です",
);

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

Deno.test({
  name: "annotation",
  async fn() {
    const context = new Context();
    await dispatch(context, ";tyuusyaku ");
    await kakutei(context);
    assertEquals("注釈", context.preEdit.output(""));
    assertEquals(
      ["注釈;これは注釈です"],
      await lib.getHenkanResult("okurinasi", "ちゅうしゃく"),
    );
  },
});

Deno.test({
  name: "turn off mode when kakutei with empty input",
  async fn() {
    const context = new Context();
    await katakana(context);
    await dispatch(context, "k");
    await kakutei(context);
    assertEquals(context.mode, "kata");
    await kakutei(context);
    assertEquals(context.mode, "hira");
  },
});
