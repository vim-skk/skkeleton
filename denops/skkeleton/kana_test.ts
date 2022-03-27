import { Context } from "./context.ts";
import { assertEquals } from "./deps/std/testing.ts";
import { dispatch } from "./function/testutil.ts";
import { registerKanaTable } from "./kana.ts";

Deno.test({
  name: "customize kanatable",
  async fn() {
    registerKanaTable("rom", {
      "jj": "newline",
      "z,": ["―", ""],
      "z.": ["―"],
    });
    const context = new Context();
    await dispatch(context, "jj");
    assertEquals(context.preEdit.output(""), "\n");
    await dispatch(context, "z,");
    assertEquals(context.preEdit.output(""), "―");
    await dispatch(context, "z.");
    assertEquals(context.preEdit.output(""), "―");
  },
});
