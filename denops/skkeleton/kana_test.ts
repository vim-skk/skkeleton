import { config } from "./config.ts";
import { Context } from "./context.ts";
import { test } from "./deps/denops_test.ts";
import { assertEquals } from "./deps/std/testing.ts";
import { dispatch } from "./function/testutil.ts";
import { registerKanaTable } from "./kana.ts";
import { currentContext } from "./store.ts";
import { initDenops } from "./testutil.ts";

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

test({
  mode: "all",
  name: "create kanatable",
  pluginName: "skkeleton",
  async fn(denops) {
    registerKanaTable("test", {
      a: ["hoge", ""],
    }, true);
    config.kanaTable = "test";
    await initDenops(denops);
    await denops.call("skkeleton#request", "enable", []);
    const context = currentContext.get();
    await dispatch(context, "a");
    assertEquals(context.preEdit.output(""), "hoge");
  },
});
