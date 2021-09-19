import { ensureBoolean, ensureNumber, ensureString } from "./deps.ts";

export const config = {
  debug: false,
  eggLikeNewline: false,
  globalJisyo: "/usr/share/skk/SKK-JISYO.L",
  globalJisyoEncoding: "euc-jp",
  immediatelyCancel: true,
  immediatelyJisyoRW: true,
  keepState: false,
  selectCandidateKeys: "asdfjkl",
  setUndoPoint: true,
  showCandidatesCount: 4,
  tabCompletion: true,
  usePopup: true,
  userJisyo: Deno.env.get("HOME") + "/.skkeleton",
  markerHenkan: "▽",
  markerHenkanSelect: "▼",
};

type Validators = {
  [P in keyof typeof config]: (x: unknown) => asserts x is typeof config[P];
};

const validators: Validators = {
  debug: ensureBoolean,
  eggLikeNewline: ensureBoolean,
  globalJisyo: ensureString,
  globalJisyoEncoding: ensureString,
  immediatelyCancel: ensureBoolean,
  immediatelyJisyoRW: ensureBoolean,
  selectCandidateKeys: (x): asserts x is string => {
    ensureString(x);
    if (x.length !== 7) {
      throw TypeError("selectCandidateKeys !== 7");
    }
  },
  keepState: ensureBoolean,
  setUndoPoint: ensureBoolean,
  showCandidatesCount: ensureNumber,
  tabCompletion: ensureBoolean,
  usePopup: ensureBoolean,
  userJisyo: ensureString,
  markerHenkan: ensureString,
  markerHenkanSelect: ensureString,
};

export function setConfig(newConfig: Record<string, unknown>) {
  const cfg = config as Record<string, unknown>;
  const val = validators as Record<string, (x: unknown) => void>;
  if (config.debug) {
    console.log("skkeleton: new config");
    console.log(newConfig);
  }
  for (const k in newConfig) {
    try {
      if (val[k]) {
        val[k](newConfig[k]);
        cfg[k] = newConfig[k];
      } else {
        throw TypeError(`unknown option: ${k}`);
      }
    } catch (e) {
      throw Error(`Illegal option detected: ${e}`);
    }
  }
}
