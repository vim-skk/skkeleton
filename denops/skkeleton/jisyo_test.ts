import { config } from "./config.ts";
import { dirname, fromFileUrl, join } from "./deps/std/path.ts";
import { assertEquals } from "./deps/std/testing.ts";
import {
  decodeJisyo,
  encodeJisyo,
  ensureJisyo,
  Library,
  load,
  loadJisyo,
} from "./jisyo.ts";

const jisyoPath = join(
  dirname(fromFileUrl(import.meta.url)),
  "testdata",
  "JISYO",
);

Deno.test({
  name: "load jisyo",
  async fn() {
    const jisyo = await loadJisyo(jisyoPath, "utf-8");
    ensureJisyo(jisyo);
    const data =
      '{"okuriari":{"てすt":["テスト"]},"okurinasi":{"てすと":["テスト","test"]}}';
    assertEquals(JSON.stringify(jisyo), data);
  },
});

Deno.test({
  name: "get candidates",
  async fn() {
    const jisyo = await loadJisyo(jisyoPath, "utf-8");
    const manager = new Library(jisyo);
    const ari = await manager.getCandidate("okuriari", "てすt");
    assertEquals(["テスト"], ari);
    const nasi = await manager.getCandidate("okurinasi", "てすと");
    assertEquals(["テスト", "test"], nasi);
  },
});

Deno.test({
  name: "register candidate",
  async fn() {
    const manager = new Library();
    // most recently registered
    manager.registerCandidate("okurinasi", "test", "a");
    manager.registerCandidate("okurinasi", "test", "b");
    assertEquals(["b", "a"], await manager.getCandidate("okurinasi", "test"));
    // and remove duplicate
    manager.registerCandidate("okurinasi", "test", "a");
    assertEquals(["a", "b"], await manager.getCandidate("okurinasi", "test"));
  },
});

Deno.test({
  name: "global/local jisyo interop",
  async fn() {
    const jisyo = await loadJisyo(jisyoPath, "utf-8");
    const library = new Library(jisyo);
    library.registerCandidate("okurinasi", "てすと", "test");

    // remove dup
    const nasi = await library.getCandidate("okurinasi", "てすと");
    assertEquals(["test", "テスト"], nasi);

    // new candidate
    // user candidates priority is higher than global
    library.registerCandidate("okurinasi", "てすと", "てすと");
    const nasi2 = await library.getCandidate("okurinasi", "てすと");
    assertEquals(["てすと", "test", "テスト"], nasi2);
  },
});

Deno.test({
  name: "encode/decode skk jisyo",
  async fn() {
    const data = await Deno.readTextFile(jisyoPath);
    const jisyo = decodeJisyo(data);
    const redata = encodeJisyo(jisyo);
    assertEquals(redata, data);
  },
});

Deno.test({
  name: "read/write skk jisyo",
  async fn() {
    config.immediatelyJisyoRW = false;
    const tmp = await Deno.makeTempFile();
    try {
      const library = await load("", tmp);
      await Deno.writeTextFile(
        tmp,
        `
;; okuri-ari entries.
;; okuri-nasi entries.
あ /あ/
      `,
      );

      // load
      await library.loadJisyo();
      assertEquals(await library.getCandidate("okurinasi", "あ"), ["あ"]);

      //save
      library.registerCandidate("okurinasi", "あ", "亜");
      await library.saveJisyo();
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
    const tmp = await Deno.makeTempFile();
    try {
      const lib = new Library(undefined, undefined, tmp);
      lib.registerCandidate("okurinasi", "ほげ", "");
      lib.registerCandidate("okuriari", "ほげ", "");
      await lib.saveJisyo();
      assertEquals(
        (await Deno.readTextFile(tmp)).indexOf("ほげ"),
        -1,
      );
    } finally {
      await Deno.remove(tmp);
    }
  },
});
