import { Denops } from "../deps.ts";
import { test } from "../deps/denops_test.ts";
import { assertEquals } from "../deps/std/testing.ts";
import { currentContext } from "../main.ts";
import { initDenops } from "../testutil.ts";
import { dispatch } from "./testutil.ts";

test({
  mode: "all",
  name: "kakutei at disable",
  pluginName: "skkeleton",
  async fn(denops: Denops) {
    await initDenops(denops);

    await denops.dispatch("skkeleton", "enable");
    await dispatch(currentContext.get(), " ");
    assertEquals(await denops.dispatch("skkeleton", "disable"), " ");
    await denops.dispatch("skkeleton", "enable");
    await dispatch(currentContext.get(), "n");
    assertEquals(await denops.dispatch("skkeleton", "disable"), "ん");
  },
});

test({
  mode: "nvim", // in vim, test executes in cmdline mode
  name: "escape from insert mode",
  pluginName: "skkeleton",
  async fn(denops: Denops) {
    await initDenops(denops);
    await denops.cmd("startinsert");
    await denops.dispatch("skkeleton", "enable");
    assertEquals(await denops.call("mode"), "i");
    await denops.dispatch("skkeleton", "disable");
    assertEquals(await denops.call("mode"), "n");
  },
});
