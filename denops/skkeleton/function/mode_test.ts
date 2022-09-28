import { autocmd, Denops, vars } from "../deps.ts";
import { test } from "../deps/denops_test.ts";
import { assertEquals } from "../deps/std/testing.ts";
import { currentLibrary } from "../jisyo.ts";
import { currentKanaTable } from "../kana.ts";
import { currentContext } from "../main.ts";
import { initDenops } from "../testutil.ts";
import { kakutei } from "./common.ts";
import { deleteChar, kanaInput } from "./input.ts";
import { abbrev, hankatakana, katakana, zenkaku } from "./mode.ts";
import { dispatch } from "./testutil.ts";

test({
  mode: "all",
  name: "Can get skkeleton mode",
  pluginName: "skkeleton",
  async fn(d: Denops) {
    await initDenops(d);
    assertEquals(await d.call("skkeleton#mode"), "");
    await d.dispatch("skkeleton", "enable");
    assertEquals(await d.call("skkeleton#mode"), "hira");
    await d.dispatch("skkeleton", "disable");
    assertEquals(await d.call("skkeleton#mode"), "");
    await d.dispatch("skkeleton", "enable");
    await katakana(currentContext.get());
    assertEquals(await d.call("skkeleton#mode"), "kata");
    await katakana(currentContext.get());
    assertEquals(await d.call("skkeleton#mode"), "hira");
    await hankatakana(currentContext.get());
    assertEquals(await d.call("skkeleton#mode"), "hankata");
    await zenkaku(currentContext.get());
    assertEquals(await d.call("skkeleton#mode"), "zenkaku");
  },
});

test({
  mode: "all",
  name: "Fire autocmd for mode changed",
  pluginName: "skkeleton",
  async fn(d: Denops) {
    await initDenops(d);
    await autocmd.define(
      d,
      "User",
      "skkeleton-mode-changed",
      "let g:skkeleton#mode_actual = g:skkeleton#mode",
    );
    await katakana(currentContext.get());
    assertEquals(await vars.g.get(d, "skkeleton#mode_actual"), "kata");
    await katakana(currentContext.get());
    assertEquals(await vars.g.get(d, "skkeleton#mode_actual"), "hira");
    await hankatakana(currentContext.get());
    assertEquals(await vars.g.get(d, "skkeleton#mode_actual"), "hankata");
    await zenkaku(currentContext.get());
    assertEquals(await vars.g.get(d, "skkeleton#mode_actual"), "zenkaku");
    currentKanaTable.set("rom");
  },
});

Deno.test({
  name: "can convert okuri string properly when mode changed",
  async fn() {
    const lib = await currentLibrary.get();
    await lib.registerCandidate("okuriari", "はg", "剥");
    const context = currentContext.init();

    await katakana(context);
    await dispatch(context, ";ha;ge");
    assertEquals(context.toString(), "▼剥ゲ");
    await kakutei(context);
    assertEquals(context.preEdit.output(""), "剥ゲ");

    await hankatakana(context);
    await dispatch(context, ";ha;ge");
    assertEquals(context.toString(), "▼剥ｹﾞ");
    await kakutei(context);
    assertEquals(context.preEdit.output(""), "剥ｹﾞ");
  },
});

Deno.test({
  name: "abbrev",
  async fn() {
    const c = currentContext.init();

    // 確定するとモードが戻る
    await abbrev(c);
    assertEquals(c.mode, "abbrev");
    await kakutei(c);
    assertEquals(c.mode, "hira");

    // 文字を消すとモードが戻る
    await abbrev(c);
    await deleteChar(c);
    assertEquals(c.mode, "hira");

    // 大文字をちゃんと打てる
    await abbrev(c);
    await kanaInput(c, "A");
    assertEquals(c.toString(), "▽A");
    // 確定したら元の状態に戻る
    await kakutei(c);
    await kanaInput(c, "A");
    assertEquals(c.toString(), "▽あ");
  },
});
