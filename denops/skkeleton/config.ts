import { Denops } from "./deps.ts";
import { ensure, is } from "./deps/unknownutil.ts";
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
  keepMode: false,
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
  useGoogleJapaneseInput: false,
  usePopup: true,
  useSkkServer: false,
  userJisyo: "~/.skkeleton",
  databasePath: "",
};

type Validators = {
  [P in keyof typeof config]: (x: unknown) => typeof config[P];
};

function ensureEncoding(x: unknown): Encoding {
  if (is.String(x) && x in Encode) {
    return x as Encoding;
  }
  throw TypeError(`${x} is invalid encoding`);
}

const validators: Validators = {
  acceptIllegalResult: (x) => ensure(x, is.Boolean),
  completionRankFile: (x) => ensure(x, is.String),
  debug: (x) => ensure(x, is.Boolean),
  eggLikeNewline: (x) => ensure(x, is.Boolean),
  globalDictionaries: (x): (string | [string, string])[] => {
    if (
      !is.ArrayOf(
        (x): x is string | [string, string] =>
          is.String(x) || is.ArrayOf(is.String)(x) && x.length === 2,
      )(x)
    ) {
      throw TypeError("'globalDictionaries' must be array of two string tuple");
    }
    return x;
  },
  globalJisyo: (x) => ensure(x, is.String),
  globalJisyoEncoding: ensureEncoding,
  globalKanaTableFiles: (x): (string | [string, string])[] => {
    if (
      !is.ArrayOf(
        (x): x is string | [string, string] =>
          is.String(x) || is.ArrayOf(is.String)(x) && x.length === 2,
      )(x)
    ) {
      throw TypeError(
        "'globalKanaTableFiles' must be array of two string tuple",
      );
    }
    return x;
  },
  immediatelyCancel: (x) => ensure(x, is.Boolean),
  immediatelyJisyoRW: (x) => ensure(x, is.Boolean),
  immediatelyOkuriConvert: (x) => ensure(x, is.Boolean),
  kanaTable: (x): string => {
    const name = ensure(x, is.String);
    try {
      getKanaTable(name);
    } catch {
      throw TypeError("can't use undefined kanaTable: " + x);
    }
    return name;
  },
  keepMode: (x) => ensure(x, is.Boolean),
  keepState: (x) => ensure(x, is.Boolean),
  markerHenkan: (x) => ensure(x, is.String),
  markerHenkanSelect: (x) => ensure(x, is.String),
  registerConvertResult: (x) => ensure(x, is.Boolean),
  selectCandidateKeys: (x) => {
    const keys = ensure(x, is.String);
    if (keys.length !== 7) {
      throw TypeError("selectCandidateKeys.length !== 7");
    }
    return keys;
  },
  setUndoPoint: (x) => ensure(x, is.Boolean),
  showCandidatesCount: (x) => ensure(x, is.Number),
  skkServerHost: (x) => ensure(x, is.String),
  skkServerPort: (x) => ensure(x, is.Number),
  skkServerReqEnc: ensureEncoding,
  skkServerResEnc: ensureEncoding,
  usePopup: (x) => ensure(x, is.Boolean),
  useGoogleJapaneseInput: (x) => ensure(x, is.Boolean),
  useSkkServer: (x) => ensure(x, is.Boolean),
  userJisyo: (x) => ensure(x, is.String),
  databasePath: (x) => ensure(x, is.String),
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
        cfg[k] = val[k](newConfig[k]);
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
