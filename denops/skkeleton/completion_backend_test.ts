import { config } from "./config.ts";
import { test } from "./testutil.ts";

import type { Denops } from "@denops/std";
import { assertEquals } from "@std/assert/equals";
import { assertRejects } from "@std/assert/rejects";
import { assertStringIncludes } from "@std/assert/string-includes";

const defaultConfig = { ...config };

type VimStatus = {
  completeInfo: { selected: number };
  completeType: string;
  completeConfirmKey: string;
};

async function vimStatus(d: Denops): Promise<VimStatus> {
  return await d.call("skkeleton#vim_status") as VimStatus;
}

// Note: `selected` while no completion is showing
const notSelected = -1;

test({
  mode: "all",
  name: "default completion backend is native",
  async fn(d: Denops) {
    Object.assign(config, defaultConfig);
    const status = await vimStatus(d);
    assertEquals(status.completeType, "native");
    assertEquals(status.completeConfirmKey, "\x19"); // <C-y>
    assertEquals(status.completeInfo.selected, notSelected);
  },
});

test({
  mode: "all",
  name: "registered completion backend is selectable",
  async fn(d: Denops) {
    Object.assign(config, defaultConfig);
    await d.cmd(
      "function! g:SkkeletonTestCompleteInfo() abort\n" +
        "  return #{ pum_visible: v:true, selected: 42 }\n" +
        "endfunction",
    );
    await d.cmd(
      "call skkeleton#register_completion_backend('test-engine', #{" +
        "  complete_info: function('g:SkkeletonTestCompleteInfo')," +
        "  confirm_key: '<Cmd>call g:SkkeletonTestConfirm()'," +
        "})",
    );
    await d.call("skkeleton#config", { completionBackend: "test-engine" });
    const status = await vimStatus(d);
    assertEquals(status.completeType, "test-engine");
    assertEquals(
      status.completeConfirmKey,
      "<Cmd>call g:SkkeletonTestConfirm()",
    );
    assertEquals(status.completeInfo.selected, 42);
  },
});

test({
  mode: "all",
  name: "unknown completion backend falls back to native",
  async fn(d: Denops) {
    Object.assign(config, defaultConfig);
    await d.call("skkeleton#config", { completionBackend: "no-such-engine" });
    const status = await vimStatus(d);
    assertEquals(status.completeType, "native");
    assertEquals(status.completeConfirmKey, "\x19"); // <C-y>
  },
});

test({
  mode: "all",
  name: "unknown completion backend is reported at skkeleton-enable-post",
  async fn(d: Denops) {
    Object.assign(config, defaultConfig);
    await d.call("skkeleton#config", { completionBackend: "no-such-engine" });
    await d.cmd("messages clear");
    // a completion source registers from skkeleton-enable-pre, which runs after
    // the first skkeleton#vim_status(), so nothing is reported from there
    await vimStatus(d);
    await vimStatus(d);
    assertEquals(
      (await d.call("execute", "messages") as string).includes(
        "unknown completionBackend",
      ),
      false,
    );
    await d.cmd("doautocmd <nomodeline> User skkeleton-enable-post");
    assertStringIncludes(
      await d.call("execute", "messages") as string,
      "unknown completionBackend: no-such-engine",
    );
  },
});

test({
  mode: "all",
  name: "a backend registered from skkeleton-enable-pre is not reported",
  async fn(d: Denops) {
    Object.assign(config, defaultConfig);
    await d.cmd(
      "function! g:SkkeletonTestLateCompleteInfo() abort\n" +
        "  return #{ pum_visible: v:false, selected: -1 }\n" +
        "endfunction",
    );
    await d.cmd(
      "autocmd User skkeleton-enable-pre ++once" +
        "  call skkeleton#register_completion_backend('late-engine', #{" +
        "    complete_info: function('g:SkkeletonTestLateCompleteInfo')," +
        "    confirm_key: '<Cmd>call g:SkkeletonTestConfirm()'," +
        "  })",
    );
    await d.call("skkeleton#config", { completionBackend: "late-engine" });
    await d.cmd("messages clear");

    // falls back to native because it is not registered on the first key
    assertEquals((await vimStatus(d)).completeType, "native");

    await d.cmd("doautocmd <nomodeline> User skkeleton-enable-pre");
    await d.cmd("doautocmd <nomodeline> User skkeleton-enable-post");
    assertEquals(
      (await d.call("execute", "messages") as string).includes(
        "unknown completionBackend",
      ),
      false,
    );
    assertEquals((await vimStatus(d)).completeType, "late-engine");
  },
});

test({
  mode: "all",
  name: "invalid completion backend definition is rejected",
  async fn(d: Denops) {
    await assertRejects(async () => {
      await d.cmd(
        "call skkeleton#register_completion_backend('broken', #{" +
          "  confirm_key: '<Cmd>call g:SkkeletonTestConfirm()'," +
          "})",
      );
    });
  },
});
