import { dirname, fromFileUrl, join } from "./deps/std/path.ts";
import { assertEquals } from "./deps/std/assert.ts";
import { Dictionary, Library, wrapDictionary } from "./dictionary.ts";
import { Dictionary as SkkDictionary } from "./sources/skk_dictionary.ts";
import { Dictionary as DenoKvDictionary } from "./sources/deno_kv.ts";
import { Dictionary as UserDictionary } from "./sources/user_dictionary.ts";

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

async function test(
  path: string,
  encoding: string,
  t: Deno.TestContext,
  callback: (jisyo: Dictionary) => Promise<void>,
): Promise<void> {
  await t.step({
    name: "SkkDictionary",
    fn: async () => {
      const dic = new SkkDictionary();
      const jisyo = await dic.load(path, encoding);
      await callback(jisyo);
    },
  });
  await t.step({
    name: "DenoKvDictionary",
    fn: async () => {
      const databasePath = await Deno.makeTempFile();
      try {
        const dic = await DenoKvDictionary.create(path, encoding, databasePath);
        const jisyo = await dic.load();
        await callback(jisyo);
        dic.cleanup();
      } finally {
        await Deno.remove(databasePath);
      }
    },
  });
}

Deno.test({
  name: "load new JisyoJson",
  async fn(t) {
    await test(newJisyoJson, "utf-8", t, async (jisyo) => {
      const manager = new Library([jisyo], new UserDictionary());
      const ari = await manager.getHenkanResult("okuriari", "わるs");
      assertEquals(["悪"], ari);
      const nasi = await manager.getHenkanResult("okurinasi", "あかね");
      assertEquals(nasi, ["茜"]);
    });
  },
});

Deno.test({
  name: "load new JisyoYaml",
  async fn(t) {
    await test(newJisyoYaml, "utf-8", t, async (jisyo) => {
      const manager = new Library([jisyo], new UserDictionary());
      const ari = await manager.getHenkanResult("okuriari", "わるs");
      assertEquals(["悪"], ari);
      const nasi = await manager.getHenkanResult("okurinasi", "あかね");
      assertEquals(nasi, ["茜"]);
    });
  },
});

Deno.test({
  name: "get candidates",
  async fn(t) {
    await test(globalJisyo, "euc-jp", t, async (jisyo) => {
      const manager = new Library([jisyo], new UserDictionary());
      const ari = await manager.getHenkanResult("okuriari", "てすt");
      assertEquals(["テスト"], ari);
      const nasi = await manager.getHenkanResult("okurinasi", "てすと");
      assertEquals(nasi, ["テスト", "test"]);
    });
  },
});

Deno.test({
  name: "get num candidates",
  async fn(t) {
    await test(numJisyo, "euc-jp", t, async (jisyo) => {
      jisyo = wrapDictionary(jisyo);
      const manager = new Library([jisyo], new UserDictionary());
      const nasi = await manager.getHenkanResult("okurinasi", "101ばん");
      assertEquals(nasi, [
        "101番",
        "１０１番",
        "一〇一番",
        "百一番",
        "CI番",
        "佰壱番",
      ]);
    });
  },
});

Deno.test({
  name: "get num candidates (Kifu)",
  async fn(t) {
    await test(numJisyo, "euc-jp", t, async (jisyo) => {
      jisyo = wrapDictionary(jisyo);
      const manager = new Library([jisyo], new UserDictionary());
      const nasi1 = await manager.getHenkanResult("okurinasi", "11おうて");
      assertEquals(nasi1, ["１一王手"]);
      const nasi2 = await manager.getHenkanResult("okurinasi", "111おうて");
      assertEquals(nasi2, ["111王手"]);
    });
  },
});

Deno.test({
  name: "get candidates from words that include numbers",
  async fn(t) {
    await test(numIncludingJisyo, "utf-8", t, async (jisyo) => {
      jisyo = wrapDictionary(jisyo);
      const manager = new Library([jisyo], new UserDictionary());
      const nasi1 = await manager.getHenkanResult("okurinasi", "cat2");
      assertEquals(nasi1, ["🐈"]);
      const nasi2 = await manager.getHenkanResult("okurinasi", "1000001");
      assertEquals(nasi2, ["東京都千代田区千代田"]);
    });
  },
});

Deno.test({
  name: "register candidate",
  async fn() {
    const dic = new UserDictionary();
    const manager = new Library([], dic);
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
    const library = new Library([jisyo], new UserDictionary());
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
