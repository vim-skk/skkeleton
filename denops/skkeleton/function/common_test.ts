import { config } from "../config.ts";
import { Context } from "../context.ts";
import { HenkanState } from "../state.ts";
import { currentContext, currentLibrary } from "../store.ts";
import { test } from "../testutil.ts";
import {
  cancel,
  kakutei,
  kakuteiKey,
  kakuteiUndo,
  purgeCandidate,
} from "./common.ts";
import { henkanInput } from "./henkan.ts";
import { deleteChar, kanaInput } from "./input.ts";
import { katakana } from "./mode.ts";
import { dispatch } from "./testutil.ts";

import type { Denops } from "@denops/std";
import * as fn from "@denops/std/function";
import { assertEquals } from "@std/assert/equals";

const lib = await currentLibrary.get();

await lib.registerHenkanResult("okurinasi", "あ", "い");
await lib.registerHenkanResult(
  "okurinasi",
  "ちゅうしゃく",
  "注釈;これは注釈です",
);
await lib.registerHenkanResult("okurinasi", "かんじ", "幹事");
await lib.registerHenkanResult("okurinasi", "かんじ", "感じ");
await lib.registerHenkanResult("okurinasi", "かんじ", "漢字");
await lib.registerHenkanResult("okuriari", "かんじr", "感じ");
await lib.registerHenkanResult("okurinasi", "しょうきょ", "消去");
await lib.registerHenkanResult("okuriari", "みt", "見");
await lib.registerHenkanResult("okuriari", "みt", "満");

// a stub that only records denops calls such as showing the candidate list
function stubDenops(called: unknown[][], ret: unknown = void 0): Denops {
  return {
    call: (name: unknown, ...args: unknown[]) => {
      called.push([name, ...args]);
      return Promise.resolve(ret);
    },
    cmd: () => Promise.resolve(),
  } as unknown as Denops;
}

// mimics how Vim applies the output of preEdit to the buffer
class Buffer {
  #segmenter = new Intl.Segmenter("ja");
  #context: Context;
  text: string;

  constructor(context: Context, text = "") {
    this.#context = context;
    this.text = text;
    this.#context.prevInput = text;
  }

  // apply the output of preEdit and update the line before the cursor
  // returns the keys that have been output
  flush(): string {
    const keys = this.#context.preEdit.output(this.#context.toString());
    for (const key of keys) {
      if (key === "\b") {
        const segments = [...this.#segmenter.segment(this.text)];
        this.text = segments.slice(0, -1).map((s) => s.segment).join("");
      } else {
        this.text += key;
      }
    }
    this.#context.prevInput = this.text;
    // the next key handling reports the buffer back to skkeleton, which is
    // where a kakutei of the previous one is learned to be in the buffer
    this.#context.resolvePendingKakutei();
    return keys;
  }
}

Deno.test({
  name: "input cancel",
  async fn() {
    const context = new Context();
    await dispatch(context, "A");
    cancel(context);
    assertEquals(context.toString(), "");
    await dispatch(context, "A ");
    cancel(context);
    assertEquals(context.toString(), "");

    config.immediatelyCancel = false;
    await dispatch(context, "A ");
    cancel(context);
    assertEquals(context.toString(), "▽あ");
    cancel(context);
    assertEquals(context.toString(), "");
  },
});

Deno.test({
  name: "annotation",
  async fn() {
    const context = new Context();
    await dispatch(context, ";tyuusyaku ");
    await kakutei(context);
    assertEquals("注釈", context.preEdit.output(""));
    assertEquals(
      ["注釈;これは注釈です"],
      await lib.getHenkanResult("okurinasi", "ちゅうしゃく"),
    );
  },
});

Deno.test({
  name: "kakutei undo",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context, "これは");
    await dispatch(context, ";kanji ");
    buffer.flush();
    assertEquals(buffer.text, "これは▼漢字");

    await kakutei(context);
    buffer.flush();
    assertEquals(buffer.text, "これは漢字");

    // the confirmed string is deleted and the candidate selection comes back
    await kakuteiUndo(context);
    assertEquals(context.toString(), "▼漢字");
    assertEquals(buffer.flush(), "\b\b▼漢字");
    assertEquals(buffer.text, "これは▼漢字");

    // can pick another candidate and confirm it
    await dispatch(context, " ");
    buffer.flush();
    assertEquals(buffer.text, "これは▼感じ");
    await kakutei(context);
    buffer.flush();
    assertEquals(buffer.text, "これは感じ");

    // back in the henkan state, so it can go back to the input state too
    await kakuteiUndo(context);
    await dispatch(context, "xx");
    buffer.flush();
    assertEquals(buffer.text, "これは▽かんじ");
  },
});

Deno.test({
  name: "kakutei undo with okuriari",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context);
    // the okuri input starts the henkan automatically
    await dispatch(context, ";kanji;ru");
    buffer.flush();
    assertEquals(buffer.text, "▼感じる");

    await kakutei(context);
    buffer.flush();
    assertEquals(buffer.text, "感じる");

    await kakuteiUndo(context);
    assertEquals(context.toString(), "▼感じる");
    assertEquals(buffer.flush(), "\b\b\b▼感じる");
    assertEquals(buffer.text, "▼感じる");
  },
});

Deno.test({
  name: "kakutei undo after selecting a candidate by key",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context);
    const called: unknown[][] = [];
    context.denops = stubDenops(called);
    const showCandidatesCount = config.showCandidatesCount;
    // set up picking a candidate from the list with selectCandidateKeys
    config.showCandidatesCount = 0;
    try {
      await dispatch(context, ";kanji ");
      buffer.flush();
      const candidates = (context.state as HenkanState).candidates;

      // pick the 2nd candidate (advances candidateIndex before the kakutei)
      await henkanInput(context, config.selectCandidateKeys[1]);
      buffer.flush();
      assertEquals(buffer.text, candidates[1]);

      await kakuteiUndo(context);
      buffer.flush();
      assertEquals(buffer.text, "▼" + candidates[1]);
    } finally {
      config.showCandidatesCount = showCandidatesCount;
    }
  },
});

Deno.test({
  name: "kakutei undo reopens candidates popup",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context);
    const called: unknown[][] = [];
    context.denops = stubDenops(called);
    const showCandidatesCount = config.showCandidatesCount;
    config.showCandidatesCount = 0;
    try {
      await dispatch(context, ";kanji ");
      buffer.flush();
      await kakutei(context);
      buffer.flush();

      // the list is closed on every key press, so it has to be shown again
      called.length = 0;
      await kakuteiUndo(context);
      assertEquals(called.length, 1);
      assertEquals(called[0][0], "skkeleton#popup#open");
    } finally {
      config.showCandidatesCount = showCandidatesCount;
    }
  },
});

Deno.test({
  name: "kakutei undo does nothing when buffer is changed",
  async fn() {
    // does nothing when the confirmed string is not right before the cursor
    for (const keys of ["です", "\b"]) {
      const context = new Context();
      const buffer = new Buffer(context);
      await dispatch(context, ";kanji ");
      buffer.flush();
      await kakutei(context);
      buffer.flush();

      // simulate the buffer being changed on the Vim side
      context.kakutei(keys);
      buffer.flush();

      await kakuteiUndo(context);
      assertEquals(context.state.type, "input");
      assertEquals(buffer.flush(), "");
    }
  },
});

Deno.test({
  name: "kakutei undo takes back a kakutei typed over and deleted again",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context);
    // the okuri input starts the henkan automatically
    await dispatch(context, ";mi;te");
    buffer.flush();
    await kakutei(context);
    buffer.flush();
    assertEquals(buffer.text, "満て");

    // the wrong candidate goes unnoticed until the rest has been typed
    await dispatch(context, "miru");
    buffer.flush();
    assertEquals(buffer.text, "満てみる");

    // deleting it back leaves the buffer as the kakutei has left it, so the
    // kakutei can still be taken back and done again
    for (const _ of "みる") {
      await deleteChar(context);
      buffer.flush();
    }
    assertEquals(buffer.text, "満て");

    await kakuteiUndo(context);
    buffer.flush();
    assertEquals(buffer.text, "▼満て");

    // the intended candidate can be picked and the rest typed again
    await dispatch(context, " ");
    await kakutei(context);
    buffer.flush();
    await dispatch(context, "miru");
    buffer.flush();
    assertEquals(buffer.text, "見てみる");
  },
});

Deno.test({
  name: "kakutei undo does nothing when the same handling has written already",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context);
    await dispatch(context, ";kanji ");
    buffer.flush();
    await kakutei(context);
    buffer.flush();
    assertEquals(buffer.text, "漢字");

    // |skkeleton#handle()| takes a list of keys, and the buffer only hears
    // about them once all of them have been handled: what the earlier key has
    // written is not in prevInput yet, so the undo cannot trust it
    await kanaInput(context, "a");
    await kakuteiUndo(context);
    assertEquals(context.state.type, "input");
    assertEquals(buffer.flush(), "あ");
    assertEquals(buffer.text, "漢字あ");
  },
});

Deno.test({
  name: "kakutei undo does nothing after the candidate has been purged",
  async fn() {
    const context = new Context();
    // the purge asks for a confirmation, which is answered with Yes
    context.denops = stubDenops([], 1);
    const buffer = new Buffer(context);
    await dispatch(context, ";syoukyo ");
    buffer.flush();
    await kakutei(context);
    buffer.flush();
    assertEquals(buffer.text, "消去");

    // the buffer is left as it is by the purge, so nothing but the purge
    // itself can tell that the candidate to go back to is gone
    await purgeCandidate(context);

    await kakuteiUndo(context);
    assertEquals(context.state.type, "input");
    assertEquals(buffer.flush(), "");
  },
});

Deno.test({
  name: "kakutei undo does nothing when the cursor has left the line",
  async fn() {
    // the line before the cursor is the same on the line moved to, so only the
    // position tells that the confirmed string is not the one before the cursor
    for (const movesBeforeReport of [true, false]) {
      const context = new Context();
      const buffer = new Buffer(context, "これは");
      await dispatch(context, ";kanji ");
      buffer.flush();
      await kakutei(context);

      // move to another line, either before Vim reports the buffer back or
      // after it has been reported and the kakutei has been resolved
      if (movesBeforeReport) {
        context.lnum += 1;
        buffer.flush();
      } else {
        buffer.flush();
        context.lnum += 1;
      }

      await kakuteiUndo(context);
      assertEquals(context.state.type, "input");
      assertEquals(buffer.flush(), "");
    }
  },
});

Deno.test({
  name: "kakutei undo does nothing while henkan",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context);
    await dispatch(context, ";kanji ");
    const henkanStr = context.toString();
    buffer.flush();
    await kakutei(context);
    buffer.flush();

    await kakuteiUndo(context);
    buffer.flush();
    assertEquals(buffer.text, henkanStr);

    // does nothing in the henkan state
    await kakuteiUndo(context);
    assertEquals(buffer.flush(), "");
    assertEquals(buffer.text, henkanStr);
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo in a buffer",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okurinasi", "てすと", "手酢戸");
    await l.registerHenkanResult("okurinasi", "てすと", "テスト");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );

    // Note: `skkeleton#handle` requires consistency of vim buffer and pre-edit buffer.
    await denops.cmd("startinsert");

    for (const key of ["T", "e", "s", "u", "t", "o", " "]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "▼テスト");

    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<nl>"})');
    assertEquals(await fn.getline(denops, "."), "テスト");

    // the confirmed string is deleted and the henkan state comes back
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-u>"})');
    assertEquals(currentContext.get().toString(), "▼テスト");
    assertEquals(await fn.getline(denops, "."), "▼テスト");

    // can pick another candidate and confirm it
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<space>"})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<nl>"})');
    assertEquals(await fn.getline(denops, "."), "手酢戸");
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo in a buffer after typing over and deleting again",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okurinasi", "てすと", "手酢戸");
    await l.registerHenkanResult("okurinasi", "てすと", "テスト");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    await denops.cmd("startinsert");

    for (const key of ["T", "e", "s", "u", "t", "o", " ", "<nl>"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "テスト");

    // the wrong candidate goes unnoticed until the rest has been typed, and
    // deleting it back leaves the buffer as the kakutei has left it
    for (const key of ["s", "u", "r", "u", "<bs>", "<bs>"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "テスト");

    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-u>"})');
    assertEquals(currentContext.get().toString(), "▼テスト");
    assertEquals(await fn.getline(denops, "."), "▼テスト");
  },
});

Deno.test({
  name: "turn off mode when kakutei with empty input",
  async fn() {
    const context = new Context();
    await katakana(context);
    await dispatch(context, "k");
    await kakuteiKey(context);
    assertEquals(context.mode, "kata");
    await kakuteiKey(context);
    assertEquals(context.mode, "hira");
  },
});
