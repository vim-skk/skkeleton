import { currentContext } from "../store.ts";
import { test } from "../testutil.ts";
import { dispatch } from "./testutil.ts";

import type { Denops } from "jsr:@denops/std@^7.6.0";
import { assertEquals } from "jsr:@std/assert@~1.0.3/equals";

// deno-lint-ignore no-explicit-any
async function getResult(x: Promise<any>): Promise<string> {
  return (await x)?.result;
}

test({
  mode: "all",
  name: "kakutei at disable",
  async fn(denops: Denops) {
    const vimStatus = {
      mode: "",
      prevInput: "",
    };
    await denops.dispatch("skkeleton", "handle", "enable", {}, vimStatus);
    await dispatch(currentContext.get(), " ");
    assertEquals(
      await getResult(
        denops.dispatch("skkeleton", "handle", "disable", {}, vimStatus),
      ),
      " ",
    );
    await denops.dispatch("skkeleton", "handle", "enable", {}, vimStatus);
    await dispatch(currentContext.get(), "n");
    vimStatus.prevInput = "n";
    assertEquals(
      await getResult(
        denops.dispatch("skkeleton", "handle", "disable", {}, vimStatus),
      ),
      "ん",
    );
  },
});

test({
  mode: "all",
  name: "disable just after completion",
  async fn(denops: Denops) {
    const vimStatus = {
      mode: "",
      prevInput: "変換結果",
    };
    await denops.dispatch("skkeleton", "handle", "enable", {}, vimStatus);
    const context = currentContext.get();
    await dispatch(context, ";hoge");
    await denops.dispatch(
      "skkeleton",
      "handle",
      "disable",
      { key: [] },
      vimStatus,
    );
    assertEquals(await denops.eval("g:skkeleton#enabled"), false);
  },
});
