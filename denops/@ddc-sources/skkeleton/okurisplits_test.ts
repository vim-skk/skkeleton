import { okuriSplits } from "./okurisplits.ts";

import { assertEquals } from "jsr:@std/assert@~1.0.3/equals";

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
