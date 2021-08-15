import { Context } from "../context.ts";
import { kanaInput } from "./input.ts";
import { assertEquals } from "../deps/std/testing.ts";

Deno.test({
  name: "kana input",
  fn() {
    const context = new Context();
    if (context.state.type !== "input") {
      throw new Error('context.state.type !== "input"');
    }
    for (const c of "nihongoutteiki") {
      kanaInput(context, c);
    }

    assertEquals(context.preEdit.kakutei, "にほんごうっていき");
  },
});
