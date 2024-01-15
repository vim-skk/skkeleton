import { Denops } from "../deps.ts";
import { assertEquals } from "../deps/std/assert.ts";
import { currentContext } from "../store.ts";
import { test } from "../testutil.ts";
import { dispatch } from "./testutil.ts";

// deno-lint-ignore no-explicit-any
async function getResult(x: Promise<any>): Promise<string> {
  return (await x)?.result;
}

test({
  mode: "all",
  name: "kakutei at disable",
  async fn(denops: Denops) {
    await denops.dispatch("skkeleton", "handle", "enable");
    await dispatch(currentContext.get(), " ");
    assertEquals(
      await getResult(denops.dispatch("skkeleton", "handle", "disable")),
      " ",
    );
    await denops.dispatch("skkeleton", "handle", "enable");
    await dispatch(currentContext.get(), "n");
    assertEquals(
      await getResult(denops.dispatch("skkeleton", "handle", "disable")),
      "ん",
    );
  },
});
