import { dirname, fromFileUrl, join } from "./deps/std/path.ts";
import { assertEquals } from "./deps/std/testing.ts";
import {
  Library,
  SKKDictionary,
  UserDictionary,
  wrapDictionary,
} from "./jisyo.ts";

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
    assertEquals(nasi, ["101番", "１０１番", "一〇一番", "百一番"]);
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
