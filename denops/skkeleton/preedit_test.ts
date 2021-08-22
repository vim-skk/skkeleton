import { assertEquals } from "./deps/std/testing.ts";
import { PreEdit } from "./preedit.ts";

Deno.test({
  name: "preedit test",
  fn() {
    const preEdit = new PreEdit();
    // `PreEdit` remembers previous string length
    // return value is remove current string and new string
    assertEquals(preEdit.output("foo"), "foo");
    assertEquals(preEdit.output("hoge"), "\b\b\bhoge");
    assertEquals(preEdit.output("piyo"), "\b\b\b\bpiyo");
    // output kakutei before new string
    preEdit.doKakutei("bar");
    assertEquals(preEdit.output("baz"), "\b\b\b\bbarbaz");
  },
});
