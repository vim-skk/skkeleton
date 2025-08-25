import { test } from "./testutil.ts";
import { currentLibrary } from "./store.ts";
import { currentContext } from "./store.ts";

import type { Denops } from "@denops/std";
import { assertEquals } from "@std/assert/equals";

test({
  mode: "nvim", // can input mode test only in nvim
  name: "registerKeyMap",
  async fn(denops: Denops) {
    const lib = await currentLibrary.get();
    lib.registerHenkanResult("okurinasi", "あ", "亜");
    await denops.cmd('call skkeleton#register_keymap("henkan", "x", "")');
    await denops.cmd(
      'call skkeleton#register_keymap("henkan", "<BS>", "henkanBackward")',
    );

    // Note: `skkeleton#handle` requires consistency of vim buffer and pre-edit buffer.
    await denops.cmd("startinsert");

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

    currentContext.init().denops = denops;

    // register a keymap that consists of a single capital letter
    await denops.cmd(
      'call skkeleton#register_keymap("henkan", "B", "henkanBackward")',
    );
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "A"})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": " "})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "B"})');
    assertEquals(currentContext.get().toString(), "▽あ");

    currentContext.init().denops = denops;

    // remove a keymap registered above
    await denops.cmd('call skkeleton#register_keymap("henkan", "B", "")');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "A"})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": " "})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "B"})');
    assertEquals(currentContext.get().toString(), "▽b");
  },
});

test({
  mode: "all",
  name: "send multiple keys into handleKey",
  async fn(denops) {
    const lib = await currentLibrary.get();
    lib.registerHenkanResult("okurinasi", "われ", "我");
    lib.registerHenkanResult("okuriari", "おもu", "思");

    await denops.cmd(
      'call skkeleton#handle("handleKey", {"key": ["W", "a", "r", "e"]})',
    );
    assertEquals(currentContext.get().toString(), "▽われ");

    currentContext.init().denops = denops;

    await denops.cmd(
      'call skkeleton#handle("handleKey", {"key": ["O", "m", "o", "U"]})',
    );
    assertEquals(currentContext.get().toString(), "▼思う");
  },
});
