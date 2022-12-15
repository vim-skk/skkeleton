import { test } from "./deps/denops_test.ts";
import { assertEquals } from "./deps/std/testing.ts";
import { currentLibrary } from "./store.ts";
import { currentContext } from "./store.ts";
import { initDenops } from "./testutil.ts";

test({
  mode: "all",
  name: "registerKeyMap",
  pluginName: "skkeleton",
  async fn(denops) {
    await initDenops(denops);
    const lib = await currentLibrary.get();
    lib.registerCandidate("okurinasi", "あ", "亜");
    await denops.cmd('call skkeleton#register_keymap("henkan", "x", "")');
    await denops.cmd(
      'call skkeleton#register_keymap("henkan", "\\<BS>", "henkanBackward")',
    );

    await denops.cmd("call skkeleton#request('enable', [])");

    // fallback to default mapping because "x" was unmapped
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "A"})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": " "})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "x"})');
    assertEquals(currentContext.get().toString(), "x");

    currentContext.init().denops = denops;

    // backward state with <BS>
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "A"})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": " "})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<bs>"})');
    assertEquals(currentContext.get().toString(), "▽あ");
  },
});
