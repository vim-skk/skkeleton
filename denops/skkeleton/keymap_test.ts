import { test } from "./deps/denops_test.ts";
import { assertEquals } from "./deps/std/testing.ts";
import { currentLibrary } from "./jisyo.ts";
import { currentContext } from "./main.ts";
import { initDenops } from "./testutil.ts";

test({
  mode: "all",
  name: "registerKeyMap",
  pluginName: "skkeleton",
  async fn(denops) {
    await initDenops(denops);
    currentLibrary.get().registerCandidate("okurinasi", "あ", "亜");
    await denops.cmd('call skkeleton#register_keymap("henkan", "x", "")');
    await denops.cmd(
      'call skkeleton#register_keymap("henkan", "\\<BS>", "henkanBackward")',
    );
    await denops.cmd("call skkeleton#request('enable', [])");

    // fallback to default mapping because "x" was unmapped
    await denops.cmd('call skkeleton#handle("handleKey", "A")');
    await denops.cmd('call skkeleton#handle("handleKey", " ")');
    await denops.cmd('call skkeleton#handle("handleKey", "x")');
    assertEquals(currentContext.get().toString(), "x");

    currentContext.init().denops = denops;

    // backward state with <BS>
    await denops.cmd('call skkeleton#handle("handleKey", "A")');
    await denops.cmd('call skkeleton#handle("handleKey", " ")');
    await denops.cmd('call skkeleton#handle("handleKey", "<bs>")');
    assertEquals(currentContext.get().toString(), "▽あ");
  },
});
