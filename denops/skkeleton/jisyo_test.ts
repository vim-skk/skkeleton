import { assertEquals } from "./deps/std/testing.ts";
import { dirname } from "./deps/std/path.ts";
import { ensureJisyo } from "./jisyo.ts";
import { decodeJisyo } from "./jisyo.ts";
import { encodeJisyo } from "./jisyo.ts";
import { fromFileUrl } from "./deps/std/path.ts";
import { join } from "./deps/std/path.ts";
import { loadJisyo } from "./jisyo.ts";
import { Library } from "./jisyo.ts";

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
    const ari = manager.getCandidates("okuriari", "てすt");
    assertEquals(["テスト"], ari);
    const nasi = manager.getCandidates("okurinasi", "てすと");
    assertEquals(["テスト", "test"], nasi);
  },
});

Deno.test({
  name: "register candidate",
  fn() {
    const manager = new Library();
    // most recently registered
    manager.registerCandidate("okurinasi", "test", "a");
    manager.registerCandidate("okurinasi", "test", "b");
    assertEquals(["b", "a"], manager.getCandidates("okurinasi", "test"));
    // and remove duplicate
    manager.registerCandidate("okurinasi", "test", "a");
    assertEquals(["a", "b"], manager.getCandidates("okurinasi", "test"));
  },
});

Deno.test({
  name: "global/local jisyo interop",
  async fn() {
    const jisyo = await loadJisyo(jisyoPath, "utf-8");
    const manager = new Library(jisyo);
    manager.registerCandidate("okurinasi", "てすと", "test");

    // remove dup
    const nasi = manager.getCandidates("okurinasi", "てすと");
    assertEquals(["test", "テスト"], nasi);

    // new candidate
    // user candidates priority is higher than global
    manager.registerCandidate("okurinasi", "てすと", "てすと");
    const nasi2 = manager.getCandidates("okurinasi", "てすと");
    assertEquals(["てすと", "test", "テスト"], nasi2);
  },
});

Deno.test({
  name: "read/write skk jisyo",
  async fn() {
    const data = await Deno.readTextFile(jisyoPath);
    const jisyo = decodeJisyo(data);
    const redata = encodeJisyo(jisyo);
    await Deno.writeTextFile("/tmp/a.txt", redata);
    assertEquals(redata, data);
  },
});
