import { config } from "./config.ts";
import { encoding } from "./deps/encoding_japanese.ts";
import { JpNum } from "./deps/japanese_numeral.ts";
import { zip } from "./deps/std/collections.ts";
import { iter } from "./deps/std/io.ts";
import { Encode } from "./types.ts";
import type { Encoding, SkkServerOptions } from "./types.ts";
import { Cell } from "./util.ts";

const okuriAriMarker = ";; okuri-ari entries.";
const okuriNasiMarker = ";; okuri-nasi entries.";

const lineRegexp = /^(\S+) \/(.*)\/$/;

function toZenkaku(n: number): string {
  return n.toString().replaceAll(/[0-9]/g, (c): string => {
    const zenkakuNumbers = ["０", "１", "２", "３", "４", "５", "６", "７", "８", "９"];
    return zenkakuNumbers[parseInt(c)];
  });
}
function toKanjiModern(n: number): string {
  return n.toString().replaceAll(/[0-9]/g, (c): string => {
    const kanjiNumbers = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    return kanjiNumbers[parseInt(c)];
  });
}
const toKanjiClassic: (n: number) => string = JpNum.number2kanji;

function convertNumber(pattern: string, entry: string): string {
  return zip(pattern.split(/(#[0-9]?)/g), entry.split(/([0-9]+)/g))
    .map(([k, e]) => {
      switch (k) {
        case "#":
        case "#0":
        case "#4":
        case "#5":
        case "#6":
        case "#7":
        case "#8":
        case "#9":
          return e;
        case "#1":
          return toZenkaku(parseInt(e));
        case "#2":
          return toKanjiModern(parseInt(e));
        case "#3":
          return toKanjiClassic(parseInt(e));
        default:
          return k;
      }
    })
    .join("");
}

export interface Dictionary {
  getCandidate(type: HenkanType, word: string): Promise<string[]>;
  getCandidates(prefix: string): Promise<[string, string[]][]>;
}

function encode(str: string, encode: Encoding): Uint8Array {
  const utf8Encoder = new TextEncoder();
  const utf8Bytes = utf8Encoder.encode(str);
  const eucBytesArray = encoding.convert(utf8Bytes, Encode[encode], "UTF8");
  const eucBytes = Uint8Array.from(eucBytesArray);
  return eucBytes;
}

export class NumberConvertWrapper implements Dictionary {
  #inner: Dictionary;

  constructor(dict: Dictionary) {
    this.#inner = dict;
  }

  async getCandidate(type: HenkanType, word: string): Promise<string[]> {
    const realWord = word.replaceAll(/[0-9]+/g, "#");
    const candidate = await this.#inner.getCandidate(type, realWord);
    if (word === realWord) {
      return candidate;
    } else {
      return candidate.map((c) => convertNumber(c, word));
    }
  }

  async getCandidates(prefix: string): Promise<[string, string[]][]> {
    const realPrefix = prefix.replaceAll(/[0-9]+/g, "#");
    const candidates = await this.#inner.getCandidates(realPrefix);
    if (prefix === realPrefix) {
      return candidates;
    } else {
      return candidates.map((
        [kana, cand],
      ) => [kana, cand.map((c) => convertNumber(c, prefix))]);
    }
  }
}

export function wrapDictionary(dict: Dictionary): Dictionary {
  return new NumberConvertWrapper(
    dict,
  );
}

function parseEntries(lines: string[]): [string, string[]][] {
  return lines.flatMap((s) => {
    const m = s.match(lineRegexp);
    if (m) {
      return [[m[1], m[2].split("/")]];
    } else {
      return [];
    }
  });
}

export class SKKDictionary implements Dictionary {
  #okuriAri: Map<string, string[]>;
  #okuriNasi: Map<string, string[]>;

  constructor(
    okuriAri?: Map<string, string[]>,
    okuriNasi?: Map<string, string[]>,
  ) {
    this.#okuriAri = okuriAri ?? new Map();
    this.#okuriNasi = okuriNasi ?? new Map();
  }

  getCandidate(type: HenkanType, word: string): Promise<string[]> {
    const target = type === "okuriari" ? this.#okuriAri : this.#okuriNasi;
    return Promise.resolve(target.get(word) ?? []);
  }

  getCandidates(prefix: string): Promise<[string, string[]][]> {
    const candidates: [string, string[]][] = [];
    for (const entry of this.#okuriNasi) {
      if (entry[0].startsWith(prefix)) {
        candidates.push(entry);
      }
    }
    candidates.sort((a, b) => a[0].localeCompare(b[0]));
    return Promise.resolve(candidates);
  }

  async load(path: string, encoding: string) {
    const decoder = new TextDecoder(encoding);
    const lines = decoder.decode(await Deno.readFile(path)).split("\n");

    const okuriAriIndex = lines.indexOf(okuriAriMarker);
    const okuriNasiIndex = lines.indexOf(okuriNasiMarker);

    const okuriAriEntries = parseEntries(lines.slice(
      okuriAriIndex + 1,
      okuriNasiIndex,
    ));
    const okuriNasiEntries = parseEntries(lines.slice(
      okuriNasiIndex + 1,
      lines.length,
    ));

    this.#okuriAri = new Map(okuriAriEntries);
    this.#okuriNasi = new Map(okuriNasiEntries);
  }
}

export class UserDictionary implements Dictionary {
  #okuriAri: Map<string, string[]>;
  #okuriNasi: Map<string, string[]>;

  #path = "";
  #loadTime = -1;

  #cachedPrefix = "";
  #cachedCandidates: [string, string[]][] = [];

  constructor(
    okuriAri?: Map<string, string[]>,
    okuriNasi?: Map<string, string[]>,
  ) {
    this.#okuriAri = okuriAri ?? new Map();
    this.#okuriNasi = okuriNasi ?? new Map();
  }

  getCandidate(type: HenkanType, word: string): Promise<string[]> {
    const target = type === "okuriari" ? this.#okuriAri : this.#okuriNasi;
    return Promise.resolve(target.get(word) ?? []);
  }

  private cacheCandidates(prefix: string) {
    if (this.#cachedPrefix === prefix) {
      return;
    }
    const candidates: [string, string[]][] = [];
    for (const entry of this.#okuriNasi) {
      if (entry[0].startsWith(prefix)) {
        candidates.push(entry);
      }
    }
    this.#cachedPrefix = prefix;
    this.#cachedCandidates = candidates;
  }

  getCandidates(prefix: string): Promise<[string, string[]][]> {
    this.cacheCandidates(prefix);
    return Promise.resolve(this.#cachedCandidates);
  }

  registerCandidate(type: HenkanType, word: string, candidate: string) {
    if (candidate === "") {
      return;
    }
    const target = type === "okuriari" ? this.#okuriAri : this.#okuriNasi;
    const oldCandidate = target.get(word) ?? [];
    target.set(
      word,
      Array.from(new Set([candidate, ...oldCandidate])),
    );
    this.#cachedPrefix = "";
  }

  private async readFile(path: string) {
    const lines = (await Deno.readTextFile(path)).split("\n");

    const okuriAriIndex = lines.indexOf(okuriAriMarker);
    const okuriNasiIndex = lines.indexOf(okuriNasiMarker);

    const okuriAriEntries = parseEntries(lines.slice(
      okuriAriIndex + 1,
      okuriNasiIndex,
    ));
    const okuriNasiEntries = parseEntries(lines.slice(
      okuriNasiIndex + 1,
      lines.length,
    ));

    this.#okuriAri = new Map(okuriAriEntries);
    this.#okuriNasi = new Map(okuriNasiEntries);
  }

  async load(path = "") {
    path = this.#path = path ?? this.#path;
    if (path) {
      try {
        const stat = await Deno.stat(path);
        const time = stat.mtime?.getTime() ?? -1;
        if (time === this.#loadTime) {
          return;
        }
        this.#loadTime = time;
        await this.readFile(path);
      } catch {
        // do nothing
      }
    }
  }

  private async writeFile(path: string) {
    // Note: in SKK dictionary reverses candidates sort order if okuriari
    const okuriAri = Array.from(this.#okuriAri).sort((a, b) =>
      b[0].localeCompare(a[0])
    ).map((e) => `${e[0]} /${e[1].join("/")}/`);
    const okuriNasi = Array.from(this.#okuriNasi).sort((a, b) =>
      a[0].localeCompare(b[0])
    ).map((e) => `${e[0]} /${e[1].join("/")}/`);
    const data = [
      [okuriAriMarker],
      okuriAri,
      [okuriNasiMarker],
      okuriNasi,
      [""],
    ].flat().join("\n");
    try {
      await Deno.writeTextFile(path, data);
    } catch (e) {
      console.log(
        `warning(skkeleton): can't write userJisyo to ${path}`,
      );
      throw e;
    }
  }

  async save() {
    if (!this.#path) {
      return;
    }
    try {
      await this.writeFile(this.#path);
    } catch (e) {
      if (config.debug) {
        console.log(e);
      }
      return;
    }
    const stat = await Deno.stat(this.#path).catch(() => void 0);
    this.#loadTime = stat?.mtime?.getTime() ?? -1;
  }
}

export type HenkanType = "okuriari" | "okurinasi";

function decode(str: Uint8Array, encode: Encoding): string {
  const decoder = new TextDecoder(encode);
  return decoder.decode(str);
}

export class SkkServer implements Dictionary {
  #conn: Deno.Conn | undefined;
  responseEncoding: Encoding;
  requestEncoding: Encoding;
  connectOptions: Deno.ConnectOptions;
  constructor(opts: SkkServerOptions) {
    this.requestEncoding = opts.requestEnc;
    this.responseEncoding = opts.responseEnc;
    this.connectOptions = {
      hostname: opts.hostname,
      port: opts.port,
    };
  }
  async connect() {
    this.#conn = await Deno.connect(this.connectOptions);
  }
  async getCandidate(word: string): Promise<string[]> {
    if (!this.#conn) return [];
    await this.#conn.write(encode(`1${word} `, this.requestEncoding));
    const result: string[] = [];
    for await (const res of iter(this.#conn)) {
      const str = decode(res, this.responseEncoding);
      result.push(...(str.at(0) === "4") ? [] : str.split("/").slice(1, -1));

      if (str.endsWith("\n")) {
        break;
      }
    }
    return result;
  }
  async getCandidates(_prefix: string): Promise<[string, string[]][]> {
    // TODO: add support for ddc.vim
    return await Promise.resolve([["", [""]]]);
  }
  close() {
    this.#conn?.write(encode("0", this.requestEncoding));
    this.#conn?.close();
  }
}

function gatherCandidates(
  collector: Map<string, Set<string>>,
  candidates: [string, string[]][],
) {
  for (const [kana, cs] of candidates) {
    const set = collector.get(kana) ?? new Set();
    cs.forEach(set.add.bind(set));
    collector.set(kana, set);
  }
}

export class Library {
  #dictionaries: Dictionary[];

  #userDictionary: UserDictionary;

  constructor(
    dictionaries?: Dictionary[],
    userDictionary?: UserDictionary,
  ) {
    this.#userDictionary = userDictionary ?? new UserDictionary();
    this.#dictionaries = [wrapDictionary(this.#userDictionary)].concat(
      dictionaries ?? [],
    );
  }

  async getCandidate(type: HenkanType, word: string): Promise<string[]> {
    const merged = new Set<string>();
    for (const dic of this.#dictionaries) {
      for (const c of await dic.getCandidate(type, word)) {
        merged.add(c);
      }
    }
    return Array.from(merged);
  }

  async getCandidates(prefix: string): Promise<[string, string[]][]> {
    if (prefix.length < 2) {
      return [];
    }
    const collector = new Map<string, Set<string>>();
    for (const dic of this.#dictionaries) {
      gatherCandidates(collector, await dic.getCandidates(prefix));
    }
    return Array.from(collector.entries())
      .map(([kana, cset]) => [kana, Array.from(cset)]);
  }

  async registerCandidate(type: HenkanType, word: string, candidate: string) {
    this.#userDictionary.registerCandidate(type, word, candidate);
    if (config.immediatelyJisyoRW) {
      await this.#userDictionary.save();
    }
  }

  async load() {
    await this.#userDictionary.load();
  }

  async save() {
    await this.#userDictionary.save();
  }
}

export async function load(
  globalDictionaryPath: string,
  userDictionaryPath: string,
  dictonaryEncoding = "euc-jp",
  skkServer?: SkkServer,
): Promise<Library> {
  const globalDictionary = new SKKDictionary();
  const userDictionary = new UserDictionary();
  try {
    await globalDictionary.load(globalDictionaryPath, dictonaryEncoding);
  } catch (e) {
    console.error("globalDictionary loading failed");
    console.error(`at ${globalDictionaryPath}`);
    if (config.debug) {
      console.error(e);
    }
  }
  try {
    await userDictionary.load(userDictionaryPath);
  } catch (e) {
    if (config.debug) {
      console.log("userDictionary loading failed");
      console.log(e);
    }
    // do nothing
  }
  try {
    skkServer?.connect();
  } catch (e) {
    if (config.debug) {
      console.log("connecting to skk server is failed");
      console.log(e);
    }
  }
  const dictionaries = [globalDictionary].flatMap((d) =>
    d ? [wrapDictionary(d)] : []
  ).concat(skkServer ? [skkServer] : []);
  return new Library(dictionaries, userDictionary);
}

export const currentLibrary = new Cell(() => new Library());
