import { Denops } from "./deps.ts";
import { getKanaTable, loadKanaTableFiles } from "./kana.ts";
import { ConfigOptions, Encode, Encoding } from "./types.ts";
import { homeExpand } from "./util.ts";

import { is } from "jsr:@core/unknownutil@~4.3.0/is";
import { ensure } from "jsr:@core/unknownutil@~4.3.0/ensure";

export const config: Omit<ConfigOptions, "globalDictionaries"> & {
  globalDictionaries: [string, string][];
} = {
  acceptIllegalResult: false,
  completionRankFile: "",
  databasePath: "",
  debug: false,
  eggLikeNewline: false,
  globalDictionaries: [],
  globalKanaTableFiles: [],
  immediatelyCancel: true,
  immediatelyDictionaryRW: true,
  immediatelyOkuriConvert: true,
  kanaTable: "rom",
  keepMode: false,
  keepState: false,
  lowercaseMap: {},
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
  sources: ["skk_dictionary"],
  usePopup: true,
  userDictionary: "~/.skkeleton",
};

type Validators = {
  [P in keyof ConfigOptions]: (x: unknown) => ConfigOptions[P];
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
  databasePath: (x) => ensure(x, is.String),
  debug: (x) => ensure(x, is.Boolean),
  eggLikeNewline: (x) => ensure(x, is.Boolean),
  globalDictionaries: (x): (string | [string, string])[] => {
    if (
      !is.ArrayOf(
        is.UnionOf(
          [is.String, is.TupleOf([is.String, is.String])] as const,
        ),
      )(x)
    ) {
      throw TypeError("'globalDictionaries' must be array of two string tuple");
    }
    return x;
  },
  globalKanaTableFiles: (x): (string | [string, string])[] => {
    if (
      !is.ArrayOf(
        is.UnionOf(
          [is.String, is.TupleOf([is.String, is.String])] as const,
        ),
      )(x)
    ) {
      throw TypeError(
        "'globalKanaTableFiles' must be array of two string tuple",
      );
    }
    return x;
  },
  immediatelyCancel: (x) => ensure(x, is.Boolean),
  immediatelyDictionaryRW: (x) => ensure(x, is.Boolean),
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
  lowercaseMap: (x) => ensure(x, is.RecordOf(is.String)),
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
  sources: (x) => ensure(x, is.ArrayOf(is.String)),
  useGoogleJapaneseInput: () => {
    throw '`useGoogleJapaneseInput` is removed. Please use `sources` with "google_japanese_input"';
  },
  usePopup: (x) => ensure(x, is.Boolean),
  useSkkServer: () => {
    throw '`useSkkServer` is removed. Please use `sources` with "skk_server"';
  },
  userDictionary: (x) => ensure(x, is.String),
};

async function normalize(
  denops: Denops,
): Promise<void> {
  config.globalDictionaries = await Promise.all(
    config.globalDictionaries.map(async (cfg) => {
      if (is.String(cfg)) {
        return [await homeExpand(cfg, denops), ""];
      } else {
        return [await homeExpand(cfg[0], denops), cfg[1]];
      }
    }),
  );
  config.globalKanaTableFiles = await Promise.all(
    config.globalKanaTableFiles.map(async (cfg) => {
      if (is.String(cfg)) {
        return await homeExpand(cfg, denops);
      } else {
        return [await homeExpand(cfg[0], denops), cfg[1]];
      }
    }),
  );
  config.userDictionary = await homeExpand(config.userDictionary, denops);
  config.completionRankFile = await homeExpand(
    config.completionRankFile,
    denops,
  );
  config.databasePath = await homeExpand(config.databasePath, denops);
}

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
  await normalize(denops);

  await loadKanaTableFiles(await Promise.all(config.globalKanaTableFiles));
}
