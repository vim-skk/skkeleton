import { Denops } from "./deps.ts";
import { config } from "./config.ts";
import { Context } from "./context.ts";
import { dispatch } from "./function/testutil.ts";
import { registerKanaTable } from "./kana.ts";
import { currentContext } from "./store.ts";
import { test } from "./testutil.ts";

import { assertEquals } from "jsr:@std/assert@~1.0.3/equals";

Deno.test({
  name: "customize kanatable",
  async fn() {
    registerKanaTable("rom", {
      "jj": "newline",
      "z,": ["―", ""],
      "z.": ["―"],
      "!": ["!!"],
    });
    // can delete kana with falsy value
    registerKanaTable("rom", {
      "!": false,
    });
    const context = new Context();
    await dispatch(context, "jj");
    assertEquals(context.preEdit.output(""), "\n");
    await dispatch(context, "z,");
    assertEquals(context.preEdit.output(""), "―");
    await dispatch(context, "z.");
    assertEquals(context.preEdit.output(""), "―");
    await dispatch(context, "!");
    assertEquals(context.preEdit.output(""), "!");
  },
});

test({
  mode: "all",
  name: "create kanatable",
  async fn(denops: Denops) {
    registerKanaTable("test", {
      a: ["hoge", ""],
    }, true);
    config.kanaTable = "test";
    await denops.call("skkeleton#handle", "enable", {});
    const context = currentContext.get();
    await dispatch(context, "a");
    assertEquals(context.preEdit.output(""), "hoge");
  },
});
