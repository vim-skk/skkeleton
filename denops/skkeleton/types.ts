import { isObject } from "../skkeleton/deps.ts";

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
  UTF32: "utf-32",
  UTF16: "utf-16",
  UTF16BE: "utf-16be",
  UTF16LE: "utf-16le",
  BINARY: "binary",
  ASCII: "ascii",
  JIS: "jis",
  UTF8: "utf-8",
  EUCJP: "euc-jp",
  SJIS: "sjis",
  UNICODE: "unicode",
  AUTO: "auto",
} as const;

export type Encoding = keyof typeof Encode;

export type SkkServerOptions = {
  requestEnc: Encoding;
  responseEnc: Encoding;
} & Deno.ConnectOptions;
