import type { Denops } from "./deps.ts";
import { assertObject, isString } from "./deps/unknownutil.ts";

let received = false;
export let notationToKey: Record<string, string> = {};
export let keyToNotation: Record<string, string> = {};

export async function receiveNotation(denops: Denops) {
  if (received) {
    return;
  }
  const n2k = await denops.eval("g:skkeleton#notation#notation_to_key");
  assertObject(n2k, isString);
  notationToKey = n2k;
  const k2n = await denops.eval("g:skkeleton#notation#key_to_notation");
  assertObject(k2n, isString);
  keyToNotation = k2n;
  received = true;
}
