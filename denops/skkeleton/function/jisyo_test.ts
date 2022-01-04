import { Denops } from "../deps.ts";
import { HenkanState } from "../state.ts";
import { assertEquals } from "../deps/std/testing.ts";
import { currentContext } from "../main.ts";
import { currentKanaTable, getKanaTable } from "../kana.ts";
import { initDenops } from "./testutil.ts";
import { jisyoTouroku } from "./jisyo.ts";
import { test } from "../deps/denops_test.ts";

test({
  mode: "all",
  name: "Don't put string when register dictionary was cancelled",
  async fn(denops: Denops) {
    await initDenops(denops);
    currentKanaTable.get();
    const state: HenkanState = {
      type: "henkan",
      mode: "okuriari",
      feed: "",
      henkanFeed: "",
      okuriFeed: "hoge",
      previousFeed: false,
      table: getKanaTable("rom"),
      converterName: "",
      word: "",
      candidates: [],
      candidateIndex: -1,
    };
    const context = currentContext.get();
    context.state = state;
    await denops.cmd('autocmd CmdlineEnter * call feedkeys("\\<Esc>", "n")');
    await jisyoTouroku(context);

    assertEquals(context.preEdit.output(""), "");
  },
});
