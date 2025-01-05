import { PreEdit } from "./preedit.ts";

import { assertEquals } from "jsr:@std/assert@~1.0.3/equals";

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

Deno.test({
  name: "preedit with grapheme",
  fn() {
    const preEdit = new PreEdit();
    assertEquals(preEdit.output("💩"), "💩");
    assertEquals(preEdit.output("🚽"), "\b🚽");
    assertEquals(preEdit.output("☀️"), "\b☀️"); // U+2600 U+FE0Fの合成文字
    assertEquals(preEdit.output("🍦"), "\b🍦");
  },
});
