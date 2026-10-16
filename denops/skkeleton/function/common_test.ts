import { config } from "../config.ts";
import { Context } from "../context.ts";
import { HenkanType } from "../dictionary.ts";
import { initializeStateWithAbbrev } from "../mode.ts";
import { HenkanState } from "../state.ts";
import { currentContext, currentLibrary } from "../store.ts";
import { test } from "../testutil.ts";
import {
  cancel,
  completionKakutei,
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
await lib.registerHenkanResult("okurinasi", "ほかん", "補間");
await lib.registerHenkanResult("okurinasi", "ほかん", "補完");
await lib.registerHenkanResult("okuriari", "おぎなw", "補");
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

// a stub which answers |skkeleton#locate_kakutei()| out of the buffer, so that
// the undo can walk the cursor back the way it does in Vim
function locatingDenops(buffer: Buffer): Denops {
  return {
    call: (name: unknown, ...args: unknown[]) => {
      if (name !== "skkeleton#locate_kakutei") {
        return Promise.resolve(void 0);
      }
      const [, , before, kakutei] = args as [number, number, string, string];
      return Promise.resolve(buffer.locate(before, kakutei));
    },
    cmd: () => Promise.resolve(),
  } as unknown as Denops;
}

// mimics how Vim applies the output of preEdit to the buffer
class Buffer {
  #segmenter = new Intl.Segmenter("ja");
  #context: Context;
  // the line in front of the cursor, which is what Vim reports as prevInput
  text: string;
  // the rest of the line: only ever filled by walking the cursor back over
  // what has been typed after a kakutei
  tail = "";

  constructor(context: Context, text = "") {
    this.#context = context;
    this.text = text;
    this.#context.prevInput = text;
  }

  // mimics |skkeleton#locate_kakutei()|: walk the cursor back to the end of the
  // kakutei, leaving what has been typed after it where it is
  locate(before: string, kakutei: string): boolean {
    const head = before + kakutei;
    const line = this.text + this.tail;
    if (!line.startsWith(head)) {
      return false;
    }
    this.text = head;
    this.tail = line.slice(head.length);
    this.#context.prevInput = this.text;
    return true;
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

// mimics a completion engine confirming an item: it replaces the pre-edit in
// the buffer by itself, which skkeleton notices at the next key handling only
async function completeItem(
  context: Context,
  buffer: Buffer,
  type: HenkanType,
  midasi: string,
  word: string,
  inserted: string,
  // what the source reports having inserted: an old source reports nothing
  reported = inserted,
) {
  const preEdit = context.toString();
  buffer.text = buffer.text.slice(0, buffer.text.length - preEdit.length) +
    inserted;
  await completionKakutei(context, type, midasi, word, reported);
  // the next key handling: prevInput tells where the completion has left the
  // cursor and the state is reset because it no longer matches the buffer
  context.prevInput = buffer.text;
  context.resolvePendingKakutei();
  await initializeStateWithAbbrev(context, ["converter"]);
  context.preEdit.output("");
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

Deno.test({
  name: "kakutei undo after a completion",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context, "これは");
    await dispatch(context, ";ho");
    buffer.flush();
    assertEquals(buffer.text, "これは▽ほ");

    // the completion confirms a candidate of a reading longer than the typed
    await completeItem(context, buffer, "okurinasi", "ほかん", "補完", "補完");
    assertEquals(buffer.text, "これは補完");

    // the confirmed string is deleted and the candidate selection comes back
    await kakuteiUndo(context);
    assertEquals(context.toString(), "▼補完");
    assertEquals(buffer.flush(), "\b\b▼補完");
    assertEquals(buffer.text, "これは▼補完");

    // another candidate of the same reading can be picked now
    await dispatch(context, " ");
    buffer.flush();
    assertEquals(buffer.text, "これは▼補間");

    // and the completed reading comes back, not the one which has been typed
    await dispatch(context, "xx");
    buffer.flush();
    assertEquals(buffer.text, "これは▽ほかん");
  },
});

Deno.test({
  name: "kakutei undo after a completion with okuriari",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context);
    await dispatch(context, ";oginaware");
    buffer.flush();
    assertEquals(buffer.text, "▽おぎなわれ");

    // the okuri source inserts the candidate followed by the okurigana
    await completeItem(context, buffer, "okuriari", "おぎなw", "補", "補われ");
    assertEquals(buffer.text, "補われ");

    await kakuteiUndo(context);
    assertEquals(context.toString(), "▼補われ");
    assertEquals(buffer.flush(), "\b\b\b▼補われ");

    // the okurigana is kept when going back to the input state
    await dispatch(context, "x");
    buffer.flush();
    assertEquals(buffer.text, "▽おぎな*われ");
  },
});

Deno.test({
  name: "kakutei undo does nothing after a completion of unknown length",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context, "これは");
    await dispatch(context, ";ho");
    buffer.flush();

    // a completion source which does not tell what it has inserted
    await completeItem(
      context,
      buffer,
      "okurinasi",
      "ほかん",
      "補完",
      "補完",
      "",
    );
    assertEquals(buffer.text, "これは補完");

    await kakuteiUndo(context);
    assertEquals(context.state.type, "input");
    assertEquals(buffer.flush(), "");
  },
});

Deno.test({
  name: "kakutei undo does nothing when buffer is changed after a completion",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context, "これは");
    await dispatch(context, ";ho");
    buffer.flush();
    await completeItem(context, buffer, "okurinasi", "ほかん", "補完", "補完");

    // simulate the buffer being changed on the Vim side
    context.kakutei("です");
    buffer.flush();

    await kakuteiUndo(context);
    assertEquals(context.state.type, "input");
    assertEquals(buffer.flush(), "");
  },
});

Deno.test({
  name: "kakutei undo leaves a rewritten kakutei alone",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context, "これは");
    context.denops = locatingDenops(buffer);
    await dispatch(context, ";kanji ");
    buffer.flush();
    await kakutei(context);
    buffer.flush();
    assertEquals(buffer.text, "これは漢字");

    // something has rewritten the line in front of the kakutei, so it is no
    // longer where it was written and must not be deleted from there
    buffer.text = "それは漢字";
    context.prevInput = buffer.text;
    await kakuteiUndo(context);
    assertEquals(context.toString(), "");
    assertEquals(buffer.flush(), "");
    assertEquals(buffer.text, "それは漢字");
  },
});

Deno.test({
  name: "kakutei undo after typing on",
  async fn() {
    const context = new Context();
    const buffer = new Buffer(context, "これは");
    context.denops = locatingDenops(buffer);
    await dispatch(context, ";kanji ");
    buffer.flush();
    await kakutei(context);
    buffer.flush();
    assertEquals(buffer.text, "これは漢字");

    // a mis-conversion is noticed after typing on
    await dispatch(context, "desu");
    buffer.flush();
    assertEquals(buffer.text, "これは漢字です");

    // the cursor walks back to the kakutei and only that is deleted
    await kakuteiUndo(context);
    assertEquals(context.toString(), "▼漢字");
    assertEquals(buffer.flush(), "\b\b▼漢字");
    assertEquals(buffer.text, "これは▼漢字");
    assertEquals(buffer.tail, "です");

    // picking another candidate rewrites the kakutei in place
    await dispatch(context, " ");
    await kakutei(context);
    buffer.flush();
    assertEquals(buffer.text + buffer.tail, "これは感じです");
  },
});

Deno.test({
  name: "kakutei undo after a kakutei by typing on a vowel",
  async fn() {
    await lib.registerHenkanResult("okurinasi", "ていせい", "訂正");
    const context = new Context();
    const buffer = new Buffer(context, "これは");
    context.denops = locatingDenops(buffer);
    await dispatch(context, ";teisei ");
    buffer.flush();

    // no kakutei key is pressed: the vowel confirms the candidate and is
    // written after it as a kana right away, with no pre-edit left behind
    await henkanInput(context, "i");
    buffer.flush();
    assertEquals(buffer.text, "これは訂正い");
    await dispatch(context, "u");
    buffer.flush();
    assertEquals(buffer.text, "これは訂正いう");

    await kakuteiUndo(context);
    assertEquals(context.toString(), "▼訂正");
    assertEquals(buffer.flush(), "\b\b▼訂正");
    assertEquals(buffer.text, "これは▼訂正");
    assertEquals(buffer.tail, "いう");
  },
});

Deno.test({
  name: "kakutei undo with okuriari after a kakutei by typing on a vowel",
  async fn() {
    await lib.registerHenkanResult("okuriari", "かえt", "帰");
    const context = new Context();
    const buffer = new Buffer(context);
    context.denops = locatingDenops(buffer);
    await dispatch(context, "KaeTte");
    buffer.flush();
    assertEquals(buffer.text, "▼帰って");

    await henkanInput(context, "i");
    await dispatch(context, "masu");
    buffer.flush();
    assertEquals(buffer.text, "帰っています");

    await kakuteiUndo(context);
    assertEquals(context.toString(), "▼帰って");
    assertEquals(buffer.flush(), "\b\b\b▼帰って");
    assertEquals(buffer.tail, "います");
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

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo in a buffer after typing on",
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

    // the wrong candidate goes unnoticed until the rest has been typed, which
    // no longer has to be deleted before taking the kakutei back
    for (const key of ["s", "u", "r", "u"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "テストする");

    // the cursor walks back over what has been typed, and only the kakutei is
    // replaced by the henkan state
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-u>"})');
    assertEquals(currentContext.get().toString(), "▼テスト");
    assertEquals(await fn.getline(denops, "."), "▼テストする");

    // picking another candidate rewrites the kakutei in place
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<space>"})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<nl>"})');
    assertEquals(await fn.getline(denops, "."), "手酢戸する");
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo in a buffer after a kakutei by typing on",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okurinasi", "てすと", "手酢戸");
    await l.registerHenkanResult("okurinasi", "てすと", "テスト");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    await denops.cmd("startinsert");

    // no kakutei key is pressed: typing on confirms the candidate and the
    // same key handling writes the next input after it
    for (const key of ["T", "e", "s", "u", "t", "o", " ", "s", "u", "r", "u"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "テストする");

    for (const key of ["<bs>", "<bs>"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "テスト");

    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-u>"})');
    assertEquals(currentContext.get().toString(), "▼テスト");
    assertEquals(await fn.getline(denops, "."), "▼テスト");
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo in a buffer after a kakutei by typing on a vowel",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okuriari", "かえt", "替");
    await l.registerHenkanResult("okuriari", "かえt", "帰");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    await denops.cmd("startinsert");

    for (const key of ["K", "a", "e", "T", "t", "e"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "▼帰って");

    // the vowel confirms the candidate and is written right after it, leaving
    // no pre-edit which would tell where the kakutei ends
    for (const key of ["i", "m", "a", "s", "u"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "帰っています");

    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-u>"})');
    assertEquals(currentContext.get().toString(), "▼帰って");
    assertEquals(await fn.getline(denops, "."), "▼帰っています");

    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<space>"})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<nl>"})');
    assertEquals(await fn.getline(denops, "."), "替っています");
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo after a completion in a buffer",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okurinasi", "ほかん", "補間");
    await l.registerHenkanResult("okurinasi", "ほかん", "補完");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    await denops.cmd("startinsert");

    for (const key of ["H", "o"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "▽ほ");

    // mimics a completion engine replacing the pre-edit with the item it
    // confirms and reporting it back through the completion source
    await denops.cmd("set virtualedit=onemore");
    await denops.cmd("call setline('.', '補完')");
    await denops.cmd("call cursor(1, len(getline('.')) + 1)");
    await denops.dispatcher.completeCallback(
      "ほかん",
      "補完",
      "okurinasi",
      "補完",
    );
    assertEquals(await fn.getline(denops, "."), "補完");

    // the completion is taken back into the candidate selection state
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-u>"})');
    assertEquals(currentContext.get().toString(), "▼補完");
    assertEquals(await fn.getline(denops, "."), "▼補完");

    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<space>"})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<nl>"})');
    assertEquals(await fn.getline(denops, "."), "補間");
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo after a completion confirmed by typing on in a buffer",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okurinasi", "ほかん", "補間");
    await l.registerHenkanResult("okurinasi", "ほかん", "補完");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    await denops.cmd("startinsert");

    for (const key of ["H", "o"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "▽ほ");

    // the popup is confirmed by typing on: the key which closes it is handled
    // first and writes its own pre-edit, and the completion is only reported
    // after that (CompleteDone)
    await denops.cmd("set virtualedit=onemore");
    await denops.cmd("call setline('.', '補完')");
    await denops.cmd("call cursor(1, len(getline('.')) + 1)");
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "r"})');
    await denops.dispatcher.completeCallback(
      "ほかん",
      "補完",
      "okurinasi",
      "補完",
    );
    assertEquals(await fn.getline(denops, "."), "補完r");

    await denops.cmd('call skkeleton#handle("handleKey", {"key": "u"})');
    assertEquals(await fn.getline(denops, "."), "補完る");

    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<bs>"})');
    assertEquals(await fn.getline(denops, "."), "補完");

    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-u>"})');
    assertEquals(currentContext.get().toString(), "▼補完");
    assertEquals(await fn.getline(denops, "."), "▼補完");
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

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo puts the cursor back where it was asked from",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    // Note: 試 is a byte shorter than the others, so the column it is put back
    //       to cannot be the one it was saved at
    await l.registerHenkanResult("okurinasi", "てすと", "試");
    await l.registerHenkanResult("okurinasi", "てすと", "手酢戸");
    await l.registerHenkanResult("okurinasi", "てすと", "テスト");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    await denops.cmd("startinsert");

    for (const key of ["T", "e", "s", "u", "t", "o", " ", "<nl>"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    for (const key of ["s", "u", "r", "u"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "テストする");
    // the cursor is at the end of the line, which is where the undo is asked
    // from and where it has to come back to
    assertEquals(await fn.col(denops, "."), 16);

    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-u>"})');
    assertEquals(await fn.getline(denops, "."), "▼テストする");

    // pick 試, which is 6 bytes shorter than テスト
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<space>"})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<space>"})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<nl>"})');
    assertEquals(await fn.getline(denops, "."), "試する");
    // back to the end of the line, not to where 試 ends (which would be 4)
    assertEquals(await fn.col(denops, "."), 10);
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo puts the cursor back after a completion has confirmed",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okurinasi", "てすと", "手酢戸");
    await l.registerHenkanResult("okurinasi", "てすと", "テスト");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    // Note: cancel has to stop at the reading for the completion to have
    //       something to complete
    await denops.cmd("call skkeleton#config(#{immediatelyCancel: v:false})");
    await denops.cmd("set virtualedit=onemore");
    await denops.cmd("startinsert");

    for (const key of ["T", "e", "s", "u", "t", "o", " ", "<nl>"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    for (const key of ["s", "u", "r", "u"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "テストする");
    assertEquals(await fn.col(denops, "."), 16);

    // take it back, then go from the henkan back to the reading with cancel
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-u>"})');
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-g>"})');
    assertEquals(await fn.getline(denops, "."), "▽てすとする");

    // mimics a completion engine replacing the pre-edit with the item it
    // confirms and reporting it back through the completion source
    await denops.cmd("call setline('.', '手酢戸する')");
    await denops.cmd("call cursor(1, 10)");
    await denops.dispatcher.completeCallback(
      "てすと",
      "手酢戸",
      "okurinasi",
      "手酢戸",
    );
    assertEquals(await fn.getline(denops, "."), "手酢戸する");
    // back to the end of the line, not to where 手酢戸 ends (which would be 10)
    assertEquals(await fn.col(denops, "."), 16);
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo forgets the cursor once nothing is left to confirm",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okurinasi", "てすと", "手酢戸");
    await l.registerHenkanResult("okurinasi", "てすと", "テスト");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    // Note: spelled out because config is shared between the tests in this
    //       file, and cancelling all the way at once is what this one needs
    await denops.cmd("call skkeleton#config(#{immediatelyCancel: v:true})");
    await denops.cmd("startinsert");

    for (const key of ["T", "e", "s", "u", "t", "o", " ", "<nl>"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    for (const key of ["s", "u", "r", "u"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "テストする");

    // take it back and then give it up, which leaves nothing to be confirmed
    // where the undo happened
    for (const key of ["<c-u>", "<c-g>"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "する");

    // an unrelated kakutei has to end where it ends, not at the column the
    // abandoned undo remembered (which would be 16)
    for (const key of ["T", "e", "s", "u", "t", "o", " ", "<nl>"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "テストする");
    assertEquals(await fn.col(denops, "."), 10);
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo puts the cursor back after a completion of a completion",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okurinasi", "ほかん", "補間");
    await l.registerHenkanResult("okurinasi", "ほかん", "補完");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    await denops.cmd("call skkeleton#config(#{immediatelyCancel: v:false})");
    await denops.cmd("set virtualedit=onemore");
    await denops.cmd("startinsert");

    // a completion confirms 補完, then the rest is typed on
    for (const key of ["H", "o"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    await denops.cmd("call setline('.', '補完')");
    await denops.cmd("call cursor(1, 7)");
    await denops.dispatcher.completeCallback(
      "ほかん",
      "補完",
      "okurinasi",
      "補完",
    );
    for (const key of ["s", "u", "r", "u"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "補完する");
    assertEquals(await fn.col(denops, "."), 13);

    // take it back and go from the henkan to the reading
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-u>"})');
    assertEquals(await fn.getline(denops, "."), "▼補完する");
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-g>"})');
    assertEquals(await fn.getline(denops, "."), "▽ほかんする");

    // an engine with auto_insert writes its preview into the buffer while the
    // item is only being selected. The next key handling sees that as a
    // mismatch against the pre-edit and resets the state over it, which must
    // not be taken for the reading having been given up on
    await denops.cmd("call setline('.', '補間する')");
    await denops.cmd("call cursor(1, 7)");
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-g>"})');

    // the selected item is then confirmed
    await denops.dispatcher.completeCallback(
      "ほかん",
      "補間",
      "okurinasi",
      "補間",
    );
    assertEquals(await fn.getline(denops, "."), "補間する");
    assertEquals(await fn.col(denops, "."), 13);
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo leaves the cursor to what a key has started since",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okurinasi", "かく", "各");
    await l.registerHenkanResult("okurinasi", "かくい", "各位");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    await denops.cmd("call skkeleton#config(#{immediatelyCancel: v:false})");
    await denops.cmd("set virtualedit=onemore");
    await denops.cmd("startinsert");

    // a completion confirms 各位 out of ▽かく
    for (const key of ["K", "a", "k", "u"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    await denops.cmd("call setline('.', '各位')");
    await denops.cmd("call cursor(1, 7)");
    await denops.dispatcher.completeCallback(
      "かくい",
      "各位",
      "okurinasi",
      "各位",
    );
    assertEquals(await fn.getline(denops, "."), "各位");

    // take it back, go to the reading and shorten it
    for (const key of ["<c-u>", "<c-g>", "<c-h>"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "▽かく");

    // 各 is only selected, and an uppercase key starts a new henkan point
    // instead of confirming it
    await denops.cmd("call setline('.', '各')");
    await denops.cmd("call cursor(1, 4)");
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "J"})');
    assertEquals(await fn.getline(denops, "."), "各▽j");
    const col = await fn.col(denops, ".");

    // the engine reports the selected candidate afterwards, from a scheduled
    // callback. The cursor belongs to the ▽ that key has started, not to the
    // column the undo remembered (which would be 4)
    await denops.dispatcher.completeCallback("かく", "各", "okurinasi", "各");
    assertEquals(await fn.col(denops, "."), col);
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo leaves the cursor to a henkan the same key has opened",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okurinasi", "かく", "各");
    await l.registerHenkanResult("okurinasi", "かく", "核");
    await l.registerHenkanResult("okurinasi", "かくい", "各位");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    await denops.cmd(
      "call skkeleton#config(#{immediatelyCancel: v:false, eggLikeNewline: v:true})",
    );
    await denops.cmd("set virtualedit=onemore");
    await denops.cmd("startinsert");

    // 各位 is confirmed and the rest is typed on
    for (const key of ["K", "a", "k", "u", "i", " ", "<nl>"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    for (const key of ["h", "o", "g", "e", "h", "o", "g", "e"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "各位ほげほげ");
    assertEquals(await fn.col(denops, "."), 19);

    // take it back, shorten the reading and convert again
    for (const key of ["<c-u>", "<c-g>", "<c-h>", " "]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "▼核ほげほげ");

    // an uppercase key confirms 核 and opens a henkan after it in one go. The
    // cursor belongs to the one it has opened, not to the column the undo
    // remembered (which would be 16, in the middle of ほげほげ)
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "J"})');
    assertEquals(await fn.getline(denops, "."), "核▽jほげほげ");
    assertEquals(await fn.col(denops, "."), 8);
  },
});

test({
  mode: "nvim", // can input mode test only in nvim
  name: "kakutei undo does not follow the cursor onto a new line",
  async fn(denops: Denops) {
    const l = await currentLibrary.get();
    await l.registerHenkanResult("okurinasi", "かく", "核");
    await denops.cmd(
      'call skkeleton#register_keymap("input", "<C-u>", "kakuteiUndo")',
    );
    // Note: a kakutei out of <CR> inserts a newline without this
    await denops.cmd("call skkeleton#config(#{eggLikeNewline: v:false})");
    await denops.cmd("set virtualedit=onemore");
    await denops.cmd("startinsert");

    for (const key of ["K", "a", "k", "u", " ", "<nl>"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    for (const key of ["h", "o", "g", "e"]) {
      await denops.cmd(`call skkeleton#handle("handleKey", {"key": "${key}"})`);
    }
    assertEquals(await fn.getline(denops, "."), "核ほげ");

    // the undo walks back, and confirming with <CR> both writes the candidate
    // and breaks the line
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<c-u>"})');
    assertEquals(await fn.getline(denops, "."), "▼核ほげ");
    await denops.cmd('call skkeleton#handle("handleKey", {"key": "<cr>"})');

    // the cursor is on the line the newline has started, so the column the undo
    // remembered means nothing and is not used
    assertEquals(await fn.getline(denops, 1), "核");
    assertEquals(await fn.getline(denops, 2), "ほげ");
    assertEquals(await fn.line(denops, "."), 2);
    assertEquals(await fn.col(denops, "."), 1);
  },
});
