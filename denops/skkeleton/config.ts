import { Denops } from "./deps.ts";
import { assert, is } from "./deps/unknownutil.ts";
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
  globalKanaTableFiles: [],
  immediatelyCancel: true,
  immediatelyJisyoRW: true,
  immediatelyOkuriConvert: true,
  kanaTable: "rom",
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
  acceptIllegalResult: (x) => assert(x, is.Boolean),
  completionRankFile: (x) => assert(x, is.String),
  debug: (x) => assert(x, is.Boolean),
  eggLikeNewline: (x) => assert(x, is.Boolean),
  globalDictionaries: (x): asserts x is (string | [string, string])[] => {
    if (
      !is.Array(
        x,
        (x): x is string | [string, string] =>
          is.String(x) || is.ArrayOf(is.String)(x) && x.length === 2,
      )
    ) {
      throw TypeError("'globalDictionaries' must be array of two string tuple");
    }
  },
  globalJisyo: (x) => assert(x, is.String),
  globalJisyoEncoding: (x) => assert(x, is.String),
  globalKanaTableFiles: (x): asserts x is (string | [string, string])[] => {
    if (
      !is.Array(
        x,
        (x): x is string | [string, string] =>
          is.String(x) || is.ArrayOf(is.String)(x) && x.length === 2,
      )
    ) {
      throw TypeError(
        "'globalKanaTableFiles' must be array of two string tuple",
      );
    }
  },
  immediatelyCancel: (x) => assert(x, is.Boolean),
  immediatelyJisyoRW: (x) => assert(x, is.Boolean),
  immediatelyOkuriConvert: (x) => assert(x, is.Boolean),
  kanaTable: (x): asserts x is string => {
    assert(x, is.String);
    try {
      getKanaTable(x);
    } catch {
      throw TypeError("can't use undefined kanaTable: " + x);
    }
  },
  keepState: (x) => assert(x, is.Boolean),
  markerHenkan: (x) => assert(x, is.String),
  markerHenkanSelect: (x) => assert(x, is.String),
  registerConvertResult: (x) => assert(x, is.Boolean),
  selectCandidateKeys: (x): asserts x is string => {
    assert(x, is.String);
    if (x.length !== 7) {
      throw TypeError("selectCandidateKeys.length !== 7");
    }
  },
  setUndoPoint: (x) => assert(x, is.Boolean),
  showCandidatesCount: (x) => assert(x, is.Number),
  skkServerHost: (x) => assert(x, is.String),
  skkServerPort: (x) => assert(x, is.Number),
  skkServerReqEnc: (x): asserts x is Encoding => {
    assert(x, is.String);
    if (!(x in Encode)) {
      throw TypeError(`${x} is invalid encoding`);
    }
  },
  skkServerResEnc: (x): asserts x is Encoding => {
    assert(x, is.String);
    if (!(x in Encode)) {
      throw TypeError(`${x} is invalid encoding`);
    }
  },
  usePopup: (x) => assert(x, is.Boolean),
  useSkkServer: (x) => assert(x, is.Boolean),
  userJisyo: (x) => assert(x, is.String),
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
