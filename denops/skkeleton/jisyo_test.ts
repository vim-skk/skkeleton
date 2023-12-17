import { dirname, fromFileUrl, join } from "./deps/std/path.ts";
import { assertEquals } from "./deps/std/assert.ts";
import { Library, load as loadJisyo, wrapDictionary } from "./jisyo.ts";
import { SkkDictionary } from "./jisyo/skk_dictionary.ts";
import { UserDictionary } from "./jisyo/user_dictionary.ts";

const newJisyoJson = join(
  dirname(fromFileUrl(import.meta.url)),
  "testdata",
  "newJisyo.json",
);

const newJisyoYaml = join(
  dirname(fromFileUrl(import.meta.url)),
  "testdata",
  "newJisyo.yaml",
);

const globalJisyo = join(
  dirname(fromFileUrl(import.meta.url)),
  "testdata",
  "globalJisyo",
);

const globalJisyo2 = join(
  dirname(fromFileUrl(import.meta.url)),
  "testdata",
  "globalJisyo2",
);

const numJisyo = join(
  dirname(fromFileUrl(import.meta.url)),
  "testdata",
  "numJisyo",
);

const numIncludingJisyo = join(
  dirname(fromFileUrl(import.meta.url)),
  "testdata",
  "numIncludingJisyo",
);

Deno.test({
  name: "load new JisyoJson",
  async fn() {
    const dic = new SkkDictionary();
    const jisyo = await dic.load(newJisyoJson, "utf-8");
    const manager = new Library([jisyo]);
    const ari = await manager.getHenkanResult("okuriari", "わるs");
    assertEquals(["悪"], ari);
    const nasi = await manager.getHenkanResult("okurinasi", "あかね");
    assertEquals(nasi, ["茜"]);
  },
});

Deno.test({
  name: "load new JisyoYaml",
  async fn() {
    const dic = new SkkDictionary();
    const jisyo = await dic.load(newJisyoYaml, "utf-8");
    const manager = new Library([jisyo]);
    const ari = await manager.getHenkanResult("okuriari", "わるs");
    assertEquals(["悪"], ari);
    const nasi = await manager.getHenkanResult("okurinasi", "あかね");
    assertEquals(nasi, ["茜"]);
  },
});

Deno.test({
  name: "get candidates",
  async fn() {
    const dic = new SkkDictionary();
    const jisyo = await dic.load(globalJisyo, "euc-jp");
    const manager = new Library([jisyo]);
    const ari = await manager.getHenkanResult("okuriari", "てすt");
    assertEquals(["テスト"], ari);
    const nasi = await manager.getHenkanResult("okurinasi", "てすと");
    assertEquals(nasi, ["テスト", "test"]);
  },
});

Deno.test({
  name: "get num candidates",
  async fn() {
    const dic = new SkkDictionary();
    const jisyo = wrapDictionary(await dic.load(numJisyo, "euc-jp"));
    const manager = new Library([jisyo]);
    const nasi = await manager.getHenkanResult("okurinasi", "101ばん");
    assertEquals(nasi, [
      "101番",
      "１０１番",
      "一〇一番",
      "百一番",
      "CI番",
      "佰壱番",
    ]);
    // HEAD
    //
  },
});

Deno.test({
  name: "get num candidates (Kifu)",
  async fn() {
    const dic = new SkkDictionary();
    const jisyo = wrapDictionary(await dic.load(numJisyo, "euc-jp"));
    const manager = new Library([jisyo]);
    const nasi1 = await manager.getHenkanResult("okurinasi", "11おうて");
    assertEquals(nasi1, ["１一王手"]);
    const nasi2 = await manager.getHenkanResult("okurinasi", "111おうて");
    assertEquals(nasi2, ["111王手"]);
  },
});

Deno.test({
  name: "get candidates from words that include numbers",
  async fn() {
    const dic = new SkkDictionary();
    const jisyo = wrapDictionary(await dic.load(numIncludingJisyo, "utf-8"));
    const manager = new Library([jisyo]);
    const nasi1 = await manager.getHenkanResult("okurinasi", "cat2");
    assertEquals(nasi1, ["🐈"]);
    const nasi2 = await manager.getHenkanResult("okurinasi", "1000001");
    assertEquals(nasi2, ["東京都千代田区千代田"]);
    //vim-skk/main
  },
});

Deno.test({
  name: "register candidate",
  async fn() {
    const manager = new Library();
    // most recently registered
    await manager.registerHenkanResult("okurinasi", "test", "a");
    await manager.registerHenkanResult("okurinasi", "test", "b");
    assertEquals(
      ["b", "a"],
      await manager.getHenkanResult("okurinasi", "test"),
    );
    // and remove duplicate
    await manager.registerHenkanResult("okurinasi", "test", "a");
    assertEquals(
      ["a", "b"],
      await manager.getHenkanResult("okurinasi", "test"),
    );
  },
});

Deno.test({
  name: "global/local jisyo interop",
  async fn() {
    const dic = new SkkDictionary();
    const jisyo = await dic.load(globalJisyo, "euc-jp");
    const library = new Library([jisyo]);
    await library.registerHenkanResult("okurinasi", "てすと", "test");

    // remove dup
    const nasi = await library.getHenkanResult("okurinasi", "てすと");
    assertEquals(["test", "テスト"], nasi);

    // new candidate
    // user candidates priority is higher than global
    await library.registerHenkanResult("okurinasi", "てすと", "てすと");
    const nasi2 = await library.getHenkanResult("okurinasi", "てすと");
    assertEquals(["てすと", "test", "テスト"], nasi2);
  },
});

Deno.test({
  name: "read/write skk jisyo",
  async fn() {
    const tmp = await Deno.makeTempFile();
    try {
      await Deno.writeTextFile(
        tmp,
        `
;; okuri-ari entries.
;; okuri-nasi entries.
あ /あ/
      `,
      );

      // load
      const dic = new UserDictionary();
      await dic.load({ path: tmp });
      assertEquals(await dic.getHenkanResult("okurinasi", "あ"), ["あ"]);

      //save
      dic.registerHenkanResult("okurinasi", "あ", "亜");
      await dic.save();
      const data = await Deno.readTextFile(tmp);
      const line = data.split("\n").find((value) => value.startsWith("あ"));
      assertEquals(line, "あ /亜/あ/");
    } finally {
      await Deno.remove(tmp);
    }
  },
});

Deno.test({
  name: "don't register empty candidate",
  async fn() {
    const dic = new UserDictionary();
    dic.registerHenkanResult("okurinasi", "ほげ", "");
    dic.registerHenkanResult("okuriari", "ほげ", "");
    assertEquals(
      await dic.getHenkanResult("okurinasi", "ほげ"),
      [],
    );
    assertEquals(
      await dic.getHenkanResult("okuriari", "ほげ"),
      [],
    );
  },
});

Deno.test({
  name: "getRanks",
  async fn() {
    // ランクは保存されていた順序あるいは登録された時刻で表される
    // 適切に比較すると最近登録した物ほど先頭に並ぶようにソートできる
    // 候補はgetCompletionResultの結果によりフィルタリングされる
    const dic = new UserDictionary();
    dic.registerHenkanResult("okurinasi", "ほげ", "hoge");
    dic.registerHenkanResult("okurinasi", "ぴよ", "piyo");
    await new Promise((r) => setTimeout(r, 2));
    dic.registerHenkanResult("okurinasi", "ほげほげ", "hogehoge");
    const a = dic.getRanks("ほげ")
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);
    assertEquals(a, ["hogehoge", "hoge"]);

    await new Promise((r) => setTimeout(r, 2));
    dic.registerHenkanResult("okurinasi", "ほげ", "hoge");
    const b = dic.getRanks("ほげ")
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);
    assertEquals(b, ["hoge", "hogehoge"]);

    const c = dic.getRanks("ぴよ")
      .map((e) => e[0]);
    assertEquals(c, ["piyo"]);
  },
});

Deno.test({
  name: "multi dictionary",
  async fn() {
    const lib = await loadJisyo([
      [globalJisyo, "euc-jp"],
      [globalJisyo2, "utf-8"],
    ], {});
    assertEquals(await lib.getHenkanResult("okurinasi", "てすと"), [
      "テスト",
      "test",
      "ﾃｽﾄ",
    ]);
    assertEquals(await lib.getHenkanResult("okurinasi", "あ"), ["a"]);
    assertEquals(await lib.getHenkanResult("okurinasi", "い"), ["i"]);
  },
});
