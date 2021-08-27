import { ensureBoolean, ensureNumber, ensureString } from "./deps.ts";

export const config = {
  eggLikeNewline: false,
  debug: false,
  globalJisyo: "/usr/share/skk/SKK-JISYO.L",
  globalJisyoEncoding: "euc-jp",
  immediatelyJisyoRW: true,
  selectCandidateKeys: "asdfjkl",
  setUndoPoint: true,
  showCandidatesCount: 4,
  usePopup: true,
  userJisyo: Deno.env.get("HOME") + "/.skkeleton",
};

type Validators = {
  [P in keyof typeof config]: (x: unknown) => asserts x is typeof config[P];
};

const validators: Validators = {
  eggLikeNewline: ensureBoolean,
  debug: ensureBoolean,
  globalJisyo: ensureString,
  globalJisyoEncoding: ensureString,
  immediatelyJisyoRW: ensureBoolean,
  selectCandidateKeys: (x): asserts x is string => {
    ensureString(x);
    if (x.length !== 7) {
      throw TypeError("selectCandidateKeys !== 7");
    }
  },
  setUndoPoint: ensureBoolean,
  showCandidatesCount: ensureNumber,
  usePopup: ensureBoolean,
  userJisyo: ensureString,
};

export function setConfig(newConfig: Record<string, unknown>) {
  const cfg = config as Record<string, unknown>;
  const val = validators as Record<string, (x: unknown) => void>;
  for (const k in newConfig) {
    try {
      if (val[k]) {
        val[k](newConfig[k]);
        cfg[k] = newConfig[k];
      } else {
        throw TypeError(`unknown option: ${k}`);
      }
    } catch (e) {
      console.error("Illegal option detected");
      console.error(e.toString());
    }
  }
}
