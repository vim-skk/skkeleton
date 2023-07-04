import { Denops } from "../deps.ts";
import { test } from "../deps/denops_test.ts";
import { assertEquals } from "../deps/std/testing.ts";
import { currentContext } from "../store.ts";
import { initDenops } from "../testutil.ts";
import { dispatch } from "./testutil.ts";

// deno-lint-ignore no-explicit-any
async function getResult(x: Promise<any>): Promise<string> {
  return (await x)?.result;
}

test({
  mode: "all",
  name: "kakutei at disable",
  pluginName: "skkeleton",
  async fn(denops: Denops) {
    await initDenops(denops);

    await denops.dispatch("skkeleton", "enable");
    await dispatch(currentContext.get(), " ");
    assertEquals(
      await getResult(denops.dispatch("skkeleton", "disable")),
      " ",
    );
    await denops.dispatch("skkeleton", "enable");
    await dispatch(currentContext.get(), "n");
    assertEquals(
      await getResult(denops.dispatch("skkeleton", "disable")),
      "ん",
    );
  },
});
