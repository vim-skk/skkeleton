import { dirname, fromFileUrl, join } from "./deps/std/path.ts";
import { assertEquals } from "./deps/std/testing.ts";
import {
  Library,
  load as loadJisyo,
  SKKDictionary,
  UserDictionary,
  wrapDictionary,
} from "./jisyo.ts";

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

async function load(path: string, encoding: string): Promise<SKKDictionary> {
  const dic = new SKKDictionary();
  await dic.load(path, encoding);
  return dic;
}

Deno.test({
  name: "get candidates",
  async fn() {
    const jisyo = await load(globalJisyo, "euc-jp");
    const manager = new Library([jisyo]);
    const ari = await manager.getCandidate("okuriari", "てすt");
    assertEquals(["テスト"], ari);
    const nasi = await manager.getCandidate("okurinasi", "てすと");
    assertEquals(nasi, ["テスト", "test"]);
  },
});

Deno.test({
  name: "get num candidates",
  async fn() {
    const jisyo = wrapDictionary(await load(numJisyo, "euc-jp"));
    const manager = new Library([jisyo]);
    const nasi = await manager.getCandidate("okurinasi", "101ばん");
    assertEquals(nasi, ["101番", "１０１番", "一〇一番", "百一番", "CI番", "佰壱番"]);
  },
});

Deno.test({
  name: "get num candidates (Kifu)",
  async fn() {
    const jisyo = wrapDictionary(await load(numJisyo, "euc-jp"));
    const manager = new Library([jisyo]);
    const nasi1 = await manager.getCandidate("okurinasi", "11おうて");
    assertEquals(nasi1, ["１一王手"]);
    const nasi2 = await manager.getCandidate("okurinasi", "111おうて");
    assertEquals(nasi2, ["111王手"]);
  },
});

Deno.test({
  name: "register candidate",
  async fn() {
    const manager = new Library();
    // most recently registered
    await manager.registerCandidate("okurinasi", "test", "a");
    await manager.registerCandidate("okurinasi", "test", "b");
    assertEquals(["b", "a"], await manager.getCandidate("okurinasi", "test"));
    // and remove duplicate
    await manager.registerCandidate("okurinasi", "test", "a");
    assertEquals(["a", "b"], await manager.getCandidate("okurinasi", "test"));
  },
});

Deno.test({
  name: "global/local jisyo interop",
  async fn() {
    const jisyo = await load(globalJisyo, "euc-jp");
    const library = new Library([jisyo]);
    await library.registerCandidate("okurinasi", "てすと", "test");

    // remove dup
    const nasi = await library.getCandidate("okurinasi", "てすと");
    assertEquals(["test", "テスト"], nasi);

    // new candidate
    // user candidates priority is higher than global
    await library.registerCandidate("okurinasi", "てすと", "てすと");
    const nasi2 = await library.getCandidate("okurinasi", "てすと");
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
      assertEquals(await dic.getCandidate("okurinasi", "あ"), ["あ"]);

      //save
      dic.registerCandidate("okurinasi", "あ", "亜");
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
    dic.registerCandidate("okurinasi", "ほげ", "");
    dic.registerCandidate("okuriari", "ほげ", "");
    assertEquals(
      await dic.getCandidate("okurinasi", "ほげ"),
      [],
    );
    assertEquals(
      await dic.getCandidate("okuriari", "ほげ"),
      [],
    );
  },
});

Deno.test({
  name: "getRanks",
  async fn() {
    // ランクは保存されていた順序あるいは登録された時刻で表される
    // 適切に比較すると最近登録した物ほど先頭に並ぶようにソートできる
    // 候補はgetCandidatesの結果によりフィルタリングされる
    const dic = new UserDictionary();
    dic.registerCandidate("okurinasi", "ほげ", "hoge");
    dic.registerCandidate("okurinasi", "ぴよ", "piyo");
    await new Promise((r) => setTimeout(r, 2));
    dic.registerCandidate("okurinasi", "ほげほげ", "hogehoge");
    const a = dic.getRanks("ほげ")
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);
    assertEquals(a, ["hogehoge", "hoge"]);

    await new Promise((r) => setTimeout(r, 2));
    dic.registerCandidate("okurinasi", "ほげ", "hoge");
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
    assertEquals(await lib.getCandidate("okurinasi", "てすと"), [
      "テスト",
      "test",
      "ﾃｽﾄ",
    ]);
    assertEquals(await lib.getCandidate("okurinasi", "あ"), ["a"]);
    assertEquals(await lib.getCandidate("okurinasi", "い"), ["i"]);
  },
});
