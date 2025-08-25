import { okuriSplits } from "./okurisplits.ts";

import { assertEquals } from "@std/assert/equals";

Deno.test({
  name: "split",
  fn() {
    const expect = [
      ["ばりか", "た"],
      ["ばり", "かた"],
      ["ば", "りかた"],
    ];
    assertEquals(okuriSplits("ばりかた"), expect);
    assertEquals(okuriSplits("あ"), []);
    assertEquals(okuriSplits(""), []);
  },
});
