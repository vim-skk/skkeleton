import { Denops } from "./deps.ts";
import {
  assertBoolean,
  assertNumber,
  assertString,
  isArray,
  isString,
} from "./deps/unknownutil.ts";
import { getKanaTable, loadKanaTableFiles } from "./kana.ts";
import { ConfigOptions, Encode, Encoding } from "./types.ts";
import { homeExpand } from "./util.ts";

export const config: ConfigOptions = {
  acceptIllegalResult: false,
  completionRankFile: "",
  debug: false,
  eggLikeNewline: false,
  globalDictionaries: [],
  globalJisyo: "/usr/share/skk/SKK-JISYO.L",
  globalJisyoEncoding: "euc-jp",
  immediatelyCancel: true,
  immediatelyJisyoRW: true,
  kanaTable: "rom",
  globalKanaTableFiles: [],
  keepState: false,
  markerHenkan: "▽",
  markerHenkanSelect: "▼",
  registerConvertResult: false,
  selectCandidateKeys: "asdfjkl",
  setUndoPoint: true,
  showCandidatesCount: 4,
  skkServerHost: "127.0.0.1",
  skkServerPort: 1178,
  skkServerReqEnc: "euc-jp",
  skkServerResEnc: "euc-jp",
  usePopup: true,
  useSkkServer: false,
  userJisyo: "~/.skkeleton",
};

type Validators = {
  [P in keyof typeof config]: (x: unknown) => asserts x is typeof config[P];
};

const validators: Validators = {
  acceptIllegalResult: assertBoolean,
  completionRankFile: assertString,
  debug: assertBoolean,
  eggLikeNewline: assertBoolean,
  globalDictionaries: (x): asserts x is (string | [string, string])[] => {
    if (
      !isArray(
        x,
        (x): x is string | [string, string] =>
          isString(x) || isArray(x, isString) && x.length === 2,
      )
    ) {
      throw TypeError("'globalDictionaries' must be array of two string tuple");
    }
  },
  globalJisyo: assertString,
  globalJisyoEncoding: assertString,
  immediatelyCancel: assertBoolean,
  immediatelyJisyoRW: assertBoolean,
  kanaTable: (x): asserts x is string => {
    assertString(x);
    try {
      getKanaTable(x);
    } catch {
      throw TypeError("can't use undefined kanaTable: " + x);
    }
  },
  globalKanaTableFiles: (x): asserts x is (string | [string, string])[] => {
    if (
      !isArray(
        x,
        (x): x is string | [string, string] =>
          isString(x) || isArray(x, isString) && x.length === 2,
      )
    ) {
      throw TypeError(
        "'globalKanaTableFiles' must be array of two string tuple",
      );
    }
  },
  keepState: assertBoolean,
  markerHenkan: assertString,
  markerHenkanSelect: assertString,
  registerConvertResult: assertBoolean,
  selectCandidateKeys: (x): asserts x is string => {
    assertString(x);
    if (x.length !== 7) {
      throw TypeError("selectCandidateKeys.length !== 7");
    }
  },
  setUndoPoint: assertBoolean,
  showCandidatesCount: assertNumber,
  skkServerHost: assertString,
  skkServerPort: assertNumber,
  skkServerReqEnc: (x): asserts x is Encoding => {
    assertString(x);
    if (!(x in Encode)) {
      throw TypeError(`${x} is invalid encoding`);
    }
  },
  skkServerResEnc: (x): asserts x is Encoding => {
    assertString(x);
    if (!(x in Encode)) {
      throw TypeError(`${x} is invalid encoding`);
    }
  },
  usePopup: assertBoolean,
  useSkkServer: assertBoolean,
  userJisyo: assertString,
};

export async function setConfig(
  newConfig: Record<string, unknown>,
  denops: Denops,
) {
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

  const files = config.globalKanaTableFiles.map(async (
    x,
  ): Promise<string | [string, string]> =>
    Array.isArray(x)
      ? [await homeExpand(x[0], denops), x[1]]
      : await homeExpand(x, denops)
  );
  await loadKanaTableFiles(await Promise.all(files));
}
