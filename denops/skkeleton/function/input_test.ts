import { Context } from "../context.ts";
import { assertEquals } from "../deps/std/testing.ts";
import { deleteChar, henkanPoint } from "./input.ts";
import { dispatch } from "./testutil.ts";

Deno.test({
  name: "kana input",
  async fn() {
    const context = new Context();
    for (const c of "nihongoutteiki") {
      await dispatch(context, c);
    }
    assertEquals(context.preEdit.output(""), "にほんごうっていき");
  },
});

Deno.test({
  name: "kana input with illegal key",
  async fn() {
    const context = new Context();
    console.log();
    for (const c of "n n n n ") {
      await dispatch(context, c);
    }
    // the last space isn't decision yet.
    assertEquals(context.preEdit.output(""), "ん ん ん ん");
  },
});

Deno.test({
  name: "henkan point",
  async fn() {
    const context = new Context();
    const tests = [
      [";", "▽"],
      [";", "▽"],
      ["y", "▽y"],
      ["a", "▽や"],
      [";", "▽や*"],
      [";", "▽や*"],
      ["t", "▽や*t"],
      ["t", "▽や*っt"],
      [";", "▽や*っ"],
    ];
    for (const test of tests) {
      await dispatch(context, test[0]);
      assertEquals(context.toString(), test[1]);
    }
  },
});

Deno.test({
  name: "delete char",
  async fn() {
    const context = new Context();
    for (const c of ";ya;tt") {
      await dispatch(context, c);
    }
    let result = context.toString();
    do {
      deleteChar(context);
      result = result.slice(0, -1);
      assertEquals(context.toString(), result);
    } while (result);
  },
});

Deno.test({
  name: "undo point",
  async fn() {
    const context = new Context();
    await dispatch(context, "a");
    henkanPoint(context);
    assertEquals(context.preEdit.output(context.toString()), "あ\x07u▽");
  },
});
