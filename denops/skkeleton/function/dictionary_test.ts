import { Denops } from "../deps.ts";
import { currentKanaTable, getKanaTable } from "../kana.ts";
import { HenkanState } from "../state.ts";
import { currentContext } from "../store.ts";
import { test } from "../testutil.ts";
import { registerWord } from "./dictionary.ts";

import { assertEquals } from "jsr:@std/assert@~1.0.3/equals";

test({
  mode: "all",
  name: "Don't put string when register dictionary was cancelled",
  async fn(denops: Denops) {
    currentKanaTable.get();
    const state: HenkanState = {
      type: "henkan",
      mode: "okuriari",
      directInput: false,
      feed: "",
      henkanFeed: "",
      okuriFeed: "hoge",
      previousFeed: false,
      table: getKanaTable("rom"),
      word: "",
      candidates: [],
      candidateIndex: -1,
    };
    const context = currentContext.get();
    context.state = state;
    await denops.cmd(
      'autocmd CmdlineEnter * ++once call feedkeys("\\<Esc>", "n")',
    );
    await registerWord(context);

    assertEquals(context.preEdit.output(""), "");
  },
});

test({
  mode: "all",
  name: "Unregistered internal mapping",
  async fn(denops: Denops) {
    currentKanaTable.get();
    const state: HenkanState = {
      type: "henkan",
      mode: "okuriari",
      directInput: false,
      feed: "",
      henkanFeed: "",
      okuriFeed: "hoge",
      previousFeed: false,
      table: getKanaTable("rom"),
      word: "",
      candidates: [],
      candidateIndex: -1,
    };
    const context = currentContext.get();
    context.state = state;
    await denops.cmd(
      'autocmd CmdlineEnter * ++once call feedkeys("\\<Esc>", "n")',
    );
    await registerWord(context);
    const ctrlg = await denops.call("maparg", "c", "<C-g>", false, true);
    const esc = await denops.call("maparg", "c", "<Esc>", false, true);

    assertEquals(ctrlg, {});
    assertEquals(esc, {});
  },
});
