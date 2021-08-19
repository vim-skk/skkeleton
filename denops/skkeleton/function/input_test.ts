import { Context } from "../context.ts";
import { deleteChar, henkanPoint, kanaInput } from "./input.ts";
import { assertEquals } from "../deps/std/testing.ts";

Deno.test({
  name: "kana input",
  fn() {
    const context = new Context();
    for (const c of "nihongoutteiki") {
      kanaInput(context, c);
    }

    assertEquals(context.preEdit.output(""), "にほんごうっていき");
  },
});

function inputChar(context: Context, char: string) {
  if (char === ";") {
    henkanPoint(context, "");
  } else {
    kanaInput(context, char);
  }
}

Deno.test({
  name: "henkan point",
  fn() {
    const context = new Context();
    const tests = [
      [";", "▽"],
      [";", "▽"],
      ["h", "▽h"],
      ["o", "▽ほ"],
      ["g", "▽ほg"],
      ["e", "▽ほげ"],
      [";", "▽ほげ*"],
      [";", "▽ほげ*"],
      ["p", "▽ほげ*p"],
      ["i", "▽ほげ*ぴ"],
      ["y", "▽ほげ*ぴy"],
      ["o", "▽ほげ*ぴよ"],
      [";", "▽ほげ*ぴよ"],
    ];
    for (const test of tests) {
      inputChar(context, test[0]);
      assertEquals(context.toString(), test[1]);
    }
  },
});

Deno.test({
  name: "delete char",
  fn() {
    const context = new Context();
    for (const c of ";hoge;piyo;ch") {
      inputChar(context, c);
    }
    let result = context.toString();
    do {
      deleteChar(context, "");
      result = result.slice(0, -1);
      assertEquals(context.toString(), result);
    } while (result);
  },
});
