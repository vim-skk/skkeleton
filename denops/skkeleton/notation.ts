import { assert } from "@core/unknownutil/assert";
import { is } from "@core/unknownutil/is";
import type { Denops } from "@denops/std";

let received = false;
export let notationToKey: Record<string, string> = {};
export let keyToNotation: Record<string, string> = {};

export async function receiveNotation(denops: Denops) {
  if (received) {
    return;
  }
  const n2k = await denops.eval("g:skkeleton#notation#notation_to_key");
  assert(n2k, is.RecordOf(is.String));
  notationToKey = n2k;
  const k2n = await denops.eval("g:skkeleton#notation#key_to_notation");
  assert(k2n, is.RecordOf(is.String));
  keyToNotation = k2n;
  received = true;
}
