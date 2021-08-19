import { PreEdit } from "./preedit.ts";
import { assertEquals } from "./deps/std/testing.ts";

Deno.test({
  name: "preedit test",
  fn() {
    const preEdit = new PreEdit();
    // `PreEdit` remembers previous string length
    // return value is remove current string and new string
    // "\x08" = "\<C-h>"
    assertEquals(preEdit.output("foo"), "foo");
    assertEquals(preEdit.output("hoge"), "\x08\x08\x08hoge");
    assertEquals(preEdit.output("piyo"), "\x08\x08\x08\x08piyo");
    // output kakutei before new string
    preEdit.doKakutei('bar');
    assertEquals(preEdit.output("baz"), "\x08\x08\x08\x08barbaz");
  },
});
