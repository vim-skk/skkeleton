import { Context } from "../context.ts";
import { batch, fn, mapping } from "../deps.ts";
import { currentLibrary } from "../jisyo.ts";
import { currentContext } from "../main.ts";
import { asInputState, HenkanState } from "../state.ts";

const cmapKeys = ["<Esc>", "<C-g>"];

export async function jisyoTouroku(context: Context): Promise<boolean> {
  const denops = context.denops!;
  await Promise.resolve();
  const state = context.state as HenkanState;
  const cmap = await Promise.all(
    cmapKeys.map(async (
      key,
    ) => ({
      key,
      map: await mapping.read(denops, key, { mode: "c" }).catch(() => {}),
    })),
  );
  await batch(denops, async (denops) => {
    for (const k of cmapKeys) {
      await mapping.map(denops, k, "<C-c>", {
        buffer: true,
        mode: "c",
      });
    }
  });
  try {
    const base = "[辞書登録] " + state.henkanFeed;
    const okuri = state.mode === "okuriari" ? "*" + state.okuriFeed : "";
    const result = await fn.input(denops, base + okuri + ": ");
    currentLibrary.get().registerCandidate(state.mode, state.word, result);
    context.preEdit.doKakutei(result);
    asInputState(state);
    return true;
  } catch (e) {
    if (e.toString().indexOf("Keyboard interrupt") === -1) {
      throw e;
    }
  } finally {
    // restore mapping
    await batch(denops, async (denops) => {
      for (const m of cmap) {
        if (m.map?.buffer) {
          await mapping.map(denops, m.map.lhs, m.map.rhs, m.map);
        } else {
          // await mapping.unmap(denops, m.map.lhs);
          await denops.cmd(`cunmap <buffer> ${m.key}`);
        }
      }
    });
    // restore stashed context
    currentContext.set(context);
  }
  return false;
}
