import type { Denops } from "./deps.ts";
import { ensureObject, isString } from "./deps/unknownutil.ts";

let received = false;
export let notationToKey: Record<string, string> = {};
export let keyToNotation: Record<string, string> = {};

export async function receiveNotation(denops: Denops) {
  if (received) {
    return;
  }
  const n2k = await denops.call("skkeleton#get_key_notations");
  ensureObject(n2k, isString);
  notationToKey = n2k;
  const k2n: Record<string, string> = {};
  for (const [n, k] of Object.entries(n2k)) {
    k2n[k] = n;
  }
  keyToNotation = k2n;
  received = true;
}
