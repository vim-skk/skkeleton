import { assertEquals } from "./deps/std/assert.ts";
import { LazyCell } from "./util.ts";

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
