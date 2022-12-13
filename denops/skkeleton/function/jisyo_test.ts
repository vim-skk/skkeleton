import { Denops } from "../deps.ts";
import { test } from "../deps/denops_test.ts";
import { assertEquals } from "../deps/std/testing.ts";
import { currentKanaTable, getKanaTable } from "../kana.ts";
import { currentContext } from "../main.ts";
import { HenkanState } from "../state.ts";
import { initDenops } from "../testutil.ts";
import { jisyoTouroku } from "./jisyo.ts";

test({
  mode: "all",
  name: "Don't put string when register dictionary was cancelled",
  async fn(denops: Denops) {
    await initDenops(denops);
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
    await jisyoTouroku(context);

    assertEquals(context.preEdit.output(""), "");
  },
});
