import { autocmd, Denops } from "./deps.ts";
import * as DenopsTest from "./deps/denops_test.ts";
import * as path from "./deps/std/path.ts";
import { main } from "./main.ts";
import { currentContext } from "./store.ts";

const runtimepath = path.resolve(
  path.fromFileUrl(new URL("../..", import.meta.url)),
);

// It is inspired from https://github.com/lambdalisue/gin.vim/blob/e737a4b59a9d391c49aaa07f7c4d91e4a29ae09c/denops/gin/util/testutil.ts
// Copyright 2021 Alisue <lambdalisue@gmail.com>
export function test(def: DenopsTest.TestDefinition): void {
  const fn = def.fn;
  DenopsTest.test({
    ...def,
    async fn(denops: Denops, t: Deno.TestContext) {
      await main(denops);
      await autocmd.emit(denops, "User", "DenopsSystemPluginPost:skkeleton", {
        nomodeline: true,
      });
      currentContext.init().denops = denops;
      await fn(denops, t);
    },
    pluginName: "skkeleton",
    prelude: [
      `set runtimepath^=${runtimepath}`,
      "runtime! plugin/skkeleton.vim",
      ...(def.prelude ?? []),
    ],
  });
}
