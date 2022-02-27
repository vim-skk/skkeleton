import {
  ensureBoolean,
  ensureNumber,
  ensureString,
} from "./deps/unknownutil.ts";
import { Encode, Encoding } from "./types.ts";

export const config = {
  acceptIllegalResult: false,
  completionRankFile: "",
  debug: false,
  eggLikeNewline: false,
  globalJisyo: "/usr/share/skk/SKK-JISYO.L",
  globalJisyoEncoding: "euc-jp",
  immediatelyCancel: true,
  immediatelyJisyoRW: true,
  keepState: false,
  markerHenkan: "▽",
  markerHenkanSelect: "▼",
  registerConvertResult: false,
  selectCandidateKeys: "asdfjkl",
  setUndoPoint: true,
  showCandidatesCount: 4,
  skkServerHost: "127.0.0.1",
  skkServerPort: 1178,
  skkServerReqEnc: "euc-jp" as Encoding,
  skkServerResEnc: "euc-jp" as Encoding,
  tabCompletion: true,
  usePopup: true,
  useSkkServer: false,
  userJisyo: "~/.skkeleton",
};

type Validators = {
  [P in keyof typeof config]: (x: unknown) => asserts x is typeof config[P];
};

const validators: Validators = {
  acceptIllegalResult: ensureBoolean,
  completionRankFile: ensureString,
  debug: ensureBoolean,
  eggLikeNewline: ensureBoolean,
  globalJisyo: ensureString,
  globalJisyoEncoding: ensureString,
  immediatelyCancel: ensureBoolean,
  immediatelyJisyoRW: ensureBoolean,
  keepState: ensureBoolean,
  markerHenkan: ensureString,
  markerHenkanSelect: ensureString,
  registerConvertResult: ensureBoolean,
  selectCandidateKeys: (x): asserts x is string => {
    ensureString(x);
    if (x.length !== 7) {
      throw TypeError("selectCandidateKeys.length !== 7");
    }
  },
  setUndoPoint: ensureBoolean,
  showCandidatesCount: ensureNumber,
  skkServerHost: ensureString,
  skkServerPort: ensureNumber,
  skkServerReqEnc: (x): asserts x is Encoding => {
    ensureString(x);
    if (!(x in Encode)) {
      throw TypeError(`${x} is invalid encoding`);
    }
  },
  skkServerResEnc: (x): asserts x is Encoding => {
    ensureString(x);
    if (!(x in Encode)) {
      throw TypeError(`${x} is invalid encoding`);
    }
  },
  tabCompletion: ensureBoolean,
  usePopup: ensureBoolean,
  useSkkServer: ensureBoolean,
  userJisyo: ensureString,
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
