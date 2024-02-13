import type { Denops } from "./deps.ts";
import { is, u } from "./deps/unknownutil.ts";

let received = false;
export let notationToKey: Record<string, string> = {};
export let keyToNotation: Record<string, string> = {};

export async function receiveNotation(denops: Denops) {
  if (received) {
    return;
  }
  const n2k = await denops.eval("g:skkeleton#notation#notation_to_key");
  u.assert(n2k, is.RecordOf(is.String));
  notationToKey = n2k;
  const k2n = await denops.eval("g:skkeleton#notation#key_to_notation");
  u.assert(k2n, is.RecordOf(is.String));
  keyToNotation = k2n;
  received = true;
}
