import { isObject } from "./deps/unknownutil.ts";

export type CompletionData = [string, string[]][];
export type RankData = [string, number][];

export type CompletionMetadata = {
  tag: "skkeleton";
  kana: string;
};

export function asCompletionMetadata(x: unknown): CompletionMetadata | null {
  if (isObject(x) && x.tag === "skkeleton") {
    return x as CompletionMetadata;
  }
  return null;
}

export const Encode = {
  "utf-32": "UTF32",
  "utf-16": "UTF16",
  "utf-16be": "UTF16BE",
  "utf-16le": "UTF16LE",
  "binary": "BINARY",
  "ascii": "ASCII",
  "jis": "JIS",
  "utf-8": "UTF8",
  "euc-jp": "EUCJP",
  "sjis": "SJIS",
  "unicode": "UNICODE",
  "auto": "AUTO",
} as const;

export type Encoding = keyof typeof Encode;

export type SkkServerOptions = {
  requestEnc: Encoding;
  responseEnc: Encoding;
} & Deno.ConnectOptions;

export type ConfigOptions = {
  acceptIllegalResult: boolean;
  completionRankFile: string;
  debug: boolean;
  eggLikeNewline: boolean;
  globalDictionaries: (string | [string, string])[];
  globalJisyo: string;
  globalJisyoEncoding: Encoding;
  immediatelyCancel: boolean;
  immediatelyJisyoRW: boolean;
  kanaTable: string;
  globalKanaTableFiles: (string | [string, string])[];
  keepState: boolean;
  markerHenkan: string;
  markerHenkanSelect: string;
  registerConvertResult: boolean;
  selectCandidateKeys: string;
  setUndoPoint: boolean;
  showCandidatesCount: number;
  skkServerHost: string;
  skkServerPort: number;
  skkServerReqEnc: Encoding;
  skkServerResEnc: Encoding;
  usePopup: boolean;
  useSkkServer: boolean;
  userJisyo: string;
};
