import { LazyCell } from "./util.ts";

import { assertEquals } from "jsr:@std/assert@~1.0.3/equals";

Deno.test({
  name: "LazyCell",
  async fn(t) {
    await t.step({
      name: "can use setInitialize multi-times",
      async fn() {
        const cell = new LazyCell(() => 0);
        cell.setInitializer(() => Promise.resolve(1));
        assertEquals(await cell.get(), 1);
        cell.setInitializer(() => Promise.resolve(2));
        assertEquals(await cell.get(), 2);
      },
    });
  },
});
