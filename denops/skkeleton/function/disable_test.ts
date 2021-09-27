import { test } from "../deps/denops_test.ts";
import { Denops } from "../deps.ts";
import { dispatch, initDenops } from "./testutil.ts";
import { assertEquals } from "../deps/std/testing.ts";
import { currentContext } from "../main.ts";

test({
  mode: "all",
  name: "kakutei at disable",
  pluginName: "skkeleton",
  async fn(denops: Denops) {
    await initDenops(denops);

    await denops.dispatch("skkeleton", "enable");
    await dispatch(currentContext.get(), " ");
    assertEquals(await denops.dispatch("skkeleton", "disable"), " \x1e");
    await denops.dispatch("skkeleton", "enable");
    await dispatch(currentContext.get(), "n");
    assertEquals(await denops.dispatch("skkeleton", "disable"), "ん\x1e");
  },
});
