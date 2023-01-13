import { config } from "./config.ts";
import { getKanaTable } from "./kana.ts";
import { encoding } from "./deps/encoding_japanese.ts";
import { wrap } from "./deps/iterator_helpers.ts";
import { JpNum } from "./deps/japanese_numeral.ts";
import { RomanNum } from "./deps/roman.ts";
import { zip } from "./deps/std/collections.ts";
import { iterateReader } from "./deps/std/streams.ts";
import { assertArray, isString } from "./deps/unknownutil.ts";
import { Encode } from "./types.ts";
import type {
  CompletionData,
  Encoding,
  RankData,
  SkkServerOptions,
} from "./types.ts";

const okuriAriMarker = ";; okuri-ari entries.";
const okuriNasiMarker = ";; okuri-nasi entries.";

function toKifu(n: number): string {
  const x = Math.floor(n / 10);
  const y = n % 10;
  if (0 < x && x < 10 && 0 < y && y < 10) {
    const a = toZenkaku(Math.floor(n / 10));
    const b = toKanjiModern(n % 10);
    return a + b;
  } else {
    return n.toString();
  }
}

function toZenkaku(n: number): string {
  return n.toString().replaceAll(/[0-9]/g, (c): string => {
    const zenkakuNumbers = [
      "０",
      "１",
      "２",
      "３",
      "４",
      "５",
      "６",
      "７",
      "８",
      "９",
    ];
    return zenkakuNumbers[parseInt(c)];
  });
}
function toKanjiModern(n: number): string {
  return n.toString().replaceAll(/[0-9]/g, (c): string => {
    const kanjiNumbers = [
      "〇",
      "一",
      "二",
      "三",
      "四",
      "五",
      "六",
      "七",
      "八",
      "九",
    ];
    return kanjiNumbers[parseInt(c)];
  });
}
const toRoman: (n: number) => string = RomanNum.convertNumberToRoman;
const toKanjiClassic: (n: number) => string = JpNum.number2kanji;

function toDaiji(n: number): string {
  return toKanjiClassic(n)
    .replace(/一/g, "壱")
    .replace(/二/g, "弐")
    .replace(/三/g, "参")
    .replace(/四/g, "肆")
    .replace(/五/g, "伍")
    .replace(/六/g, "陸")
    .replace(/七/g, "漆")
    .replace(/八/g, "捌")
    .replace(/九/g, "玖")
    .replace(/〇/g, "零")
    .replace(/十/g, "拾")
    .replace(/百/g, "佰")
    .replace(/千/g, "阡")
    .replace(/万/g, "萬");
}

function convertNumber(pattern: string, entry: string): string {
  return zip(pattern.split(/(#[0-9]?)/g), entry.split(/([0-9]+)/g))
    .map(([k, e]) => {
      switch (k) {
        case "#":
        case "#0":
        case "#4":
        case "#6":
        case "#7":
          return e;
        case "#9":
          return toKifu(parseInt(e));
        case "#1":
          return toZenkaku(parseInt(e));
        case "#2":
          return toKanjiModern(parseInt(e));
        case "#3":
          return toKanjiClassic(parseInt(e));
        case "#8":
          return toRoman(parseInt(e));
        case "#5":
          return toDaiji(parseInt(e));
        default:
          return k;
      }
    })
    .join("");
}

export interface Dictionary {
  getCandidate(type: HenkanType, word: string): Promise<string[]>;
  getCandidates(prefix: string, feed: string): Promise<CompletionData>;
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
      candidate.unshift(...(await this.#inner.getCandidate(type, word)));
      return candidate.map((c) => convertNumber(c, word));
    }
  }

  async getCandidates(prefix: string, feed: string): Promise<CompletionData> {
    const realPrefix = prefix.replaceAll(/[0-9]+/g, "#");
    const candidates = await this.#inner.getCandidates(realPrefix, feed);
    if (prefix === realPrefix) {
      return candidates;
    } else {
      candidates.unshift(...(await this.#inner.getCandidates(prefix, feed)));
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

export class SKKDictionary implements Dictionary {
  #okuriAri: Map<string, string[]>;
  #okuriNasi: Map<string, string[]>;

  #cachedCandidates: Map<string, CompletionData>;

  constructor(
    okuriAri?: Map<string, string[]>,
    okuriNasi?: Map<string, string[]>,
  ) {
    this.#okuriAri = okuriAri ?? new Map();
    this.#okuriNasi = okuriNasi ?? new Map();
    this.#cachedCandidates = new Map();
  }

  getCandidate(type: HenkanType, word: string): Promise<string[]> {
    const target = type === "okuriari" ? this.#okuriAri : this.#okuriNasi;
    return Promise.resolve(target.get(word) ?? []);
  }

  getCandidates(prefix: string, feed: string): Promise<CompletionData> {
    const candidates: CompletionData = [];
    if (feed != "") {
      const table = getKanaTable();
      for (const [key, kanas] of table) {
        if (key.startsWith(feed) && kanas.length > 1) {
          const feedPrefix = prefix + (kanas as string[])[0];
          for (const entry of this.getCachedCandidates(prefix[0])) {
            if (entry[0].startsWith(feedPrefix)) {
              candidates.push(entry);
            }
          }
        }
      }
    } else {
      for (const entry of this.getCachedCandidates(prefix[0])) {
        if (entry[0].startsWith(prefix)) {
          candidates.push(entry);
        }
      }
    }

    candidates.sort((a, b) => a[0].localeCompare(b[0]));
    return Promise.resolve(candidates);
  }

  private getCachedCandidates(prefix: string): CompletionData {
    if (this.#cachedCandidates.has(prefix)) {
      const candidates = this.#cachedCandidates.get(prefix);
      return candidates ?? [];
    }

    const candidates: CompletionData = [];
    for (const entry of this.#okuriNasi) {
      if (entry[0].startsWith(prefix)) {
        candidates.push(entry);
      }
    }

    this.#cachedCandidates.set(prefix, candidates);
    return candidates;
  }

  async load(path: string, encoding: string) {
    let mode = -1;
    this.#okuriAri = new Map();
    this.#okuriNasi = new Map();
    const a: Map<string, string[]>[] = [this.#okuriAri, this.#okuriNasi];
    const decoder = new TextDecoder(encoding);
    const lines = decoder.decode(await Deno.readFile(path)).split("\n");
    for (const line of lines) {
      if (line === okuriAriMarker) {
        mode = 0;
        continue;
      }
      if (line === okuriNasiMarker) {
        mode = 1;
        continue;
      }
      if (mode == -1) continue;
      const pos = line.indexOf(" ");
      if (pos !== -1) {
        a[mode].set(line.substring(0, pos), line.slice(pos + 2, -1).split("/"));
      }
    }
  }
}

type UserDictionaryPath = {
  path?: string;
  rankPath?: string;
};

export class UserDictionary implements Dictionary {
  #okuriAri: Map<string, string[]>;
  #okuriNasi: Map<string, string[]>;
  #rank: Map<string, number>;

  #path = "";
  #rankPath = "";
  #loadTime = -1;

  #cachedPrefix = "";
  #cachedFeed = "";
  #cachedCandidates: CompletionData = [];

  constructor(
    okuriAri?: Map<string, string[]>,
    okuriNasi?: Map<string, string[]>,
    rank?: Map<string, number>,
  ) {
    this.#okuriAri = okuriAri ?? new Map();
    this.#okuriNasi = okuriNasi ?? new Map();
    this.#rank = rank ?? new Map();
  }

  getCandidate(type: HenkanType, word: string): Promise<string[]> {
    const target = type === "okuriari" ? this.#okuriAri : this.#okuriNasi;
    return Promise.resolve(target.get(word) ?? []);
  }

  private cacheCandidates(prefix: string, feed: string) {
    if (this.#cachedPrefix === prefix && this.#cachedFeed == feed) {
      return;
    }
    const candidates: CompletionData = [];
    if (feed != "") {
      const table = getKanaTable(config.kanaTable);
      for (const [key, kanas] of table) {
        if (key.startsWith(feed) && kanas.length > 1) {
          const feedPrefix = prefix + (kanas as string[])[0];
          for (const entry of this.#okuriNasi) {
            if (entry[0].startsWith(feedPrefix)) {
              candidates.push(entry);
            }
          }
        }
      }
    } else {
      for (const entry of this.#okuriNasi) {
        if (entry[0].startsWith(prefix)) {
          candidates.push(entry);
        }
      }
    }
    this.#cachedPrefix = prefix;
    this.#cachedFeed = feed;
    this.#cachedCandidates = candidates;
  }

  getCandidates(prefix: string, feed: string): Promise<CompletionData> {
    this.cacheCandidates(prefix, feed);
    return Promise.resolve(this.#cachedCandidates);
  }

  getRanks(prefix: string): RankData {
    const set = new Set();
    const adder = set.add.bind(set);
    this.cacheCandidates(prefix, "");
    for (const [, cs] of this.#cachedCandidates) {
      cs.forEach(adder);
    }
    return wrap(this.#rank.entries())
      .filter((e) => set.has(e[0]))
      .toArray();
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
    this.#rank.set(candidate, Date.now());
    this.#cachedPrefix = "";
  }

  purgeCandidate(type: HenkanType, word: string, candidate: string) {
    const target = type === "okuriari" ? this.#okuriAri : this.#okuriNasi;
    const newCandidate = (target.get(word) ?? []).filter((c) => c != candidate);
    if (newCandidate.length > 0) {
      target.set(word, newCandidate);
    } else {
      target.delete(word);
    }
  }

  private async readFile(path: string, rankPath: string) {
    let mode = -1;
    this.#okuriAri = new Map();
    this.#okuriNasi = new Map();
    const a: Map<string, string[]>[] = [this.#okuriAri, this.#okuriNasi];
    const lines = (await Deno.readTextFile(path)).split("\n");
    for (const line of lines) {
      if (line === okuriAriMarker) {
        mode = 0;
        continue;
      }
      if (line === okuriNasiMarker) {
        mode = 1;
        continue;
      }
      if (mode == -1) continue;
      const pos = line.indexOf(" ");
      if (pos !== -1) {
        a[mode].set(line.substring(0, pos), line.slice(pos + 2, -1).split("/"));
      }
    }

    // rank
    if (!rankPath) {
      return;
    }
    const rankData = JSON.parse(await Deno.readTextFile(rankPath));
    assertArray(rankData, isString);
    this.#rank = new Map(rankData.map((c, i) => [c, i]));
  }

  async load({ path, rankPath }: UserDictionaryPath = {}) {
    path = this.#path = path ?? this.#path;
    rankPath = this.#rankPath = rankPath ?? this.#rankPath;
    if (path) {
      try {
        const stat = await Deno.stat(path);
        const time = stat.mtime?.getTime() ?? -1;
        if (time === this.#loadTime) {
          return;
        }
        this.#loadTime = time;
        await this.readFile(path, rankPath);
      } catch {
        // do nothing
      }
      this.#cachedPrefix = "";
    }
  }

  private async writeFile(path: string, rankPath: string) {
    // dictionary
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
    // rank
    if (!rankPath) {
      return;
    }
    const rankData = JSON.stringify(
      Array.from(this.#rank.entries()).sort((a, b) => a[1] - b[1]).map((e) =>
        e[0]
      ),
    );
    try {
      await Deno.writeTextFile(rankPath, rankData);
    } catch (e) {
      console.log(
        `warning(skkeleton): can't write candidate rank data to ${rankPath}`,
      );
      throw e;
    }
  }

  async save() {
    if (!this.#path) {
      return;
    }
    try {
      await this.writeFile(this.#path, this.#rankPath);
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
  async getCandidate(_type: HenkanType, word: string): Promise<string[]> {
    if (!this.#conn) return [];

    await this.#conn.write(encode(`1${word} `, this.requestEncoding));
    const result: string[] = [];
    for await (const res of iterateReader(this.#conn)) {
      const str = decode(res, this.responseEncoding);
      result.push(...(str.at(0) === "4") ? [] : str.split("/").slice(1, -1));

      if (str.endsWith("\n")) {
        break;
      }
    }
    return result;
  }
  async getCandidates(prefix: string, feed: string): Promise<CompletionData> {
    if (!this.#conn) return [];

    let midashis: string[] = [];
    if (feed != "") {
      const table = getKanaTable();
      for (const [key, kanas] of table) {
        if (key.startsWith(feed) && kanas.length > 1) {
          const feedPrefix = prefix + (kanas as string[])[0];
          midashis = midashis.concat(await this.getMidashis(feedPrefix));
        }
      }
    } else {
      midashis = await this.getMidashis(prefix);
    }

    const candidates: CompletionData = [];
    for (const midashi of midashis) {
      candidates.push([midashi, await this.getCandidate("okurinasi", midashi)]);
    }

    return candidates;
  }
  private async getMidashis(prefix: string): Promise<string[]> {
    // Get midashis from prefix
    if (!this.#conn) return [];

    await this.#conn.write(encode(`4${prefix} `, this.requestEncoding));
    const midashis: string[] = [];
    for await (const res of iterateReader(this.#conn)) {
      const str = decode(res, this.responseEncoding);
      midashis.push(...(str.at(0) === "4") ? [] : str.split("/").slice(1, -1));

      if (str.endsWith("\n")) {
        break;
      }
    }

    return midashis;
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

  async getCandidates(prefix: string, feed: string): Promise<CompletionData> {
    if (prefix.length < 2) {
      return [];
    }
    const collector = new Map<string, Set<string>>();
    for (const dic of this.#dictionaries) {
      gatherCandidates(collector, await dic.getCandidates(prefix, feed));
    }
    return Array.from(collector.entries())
      .map(([kana, cset]) => [kana, Array.from(cset)]);
  }

  getRanks(prefix: string): RankData {
    return this.#userDictionary.getRanks(prefix);
  }

  async registerCandidate(type: HenkanType, word: string, candidate: string) {
    this.#userDictionary.registerCandidate(type, word, candidate);
    if (config.immediatelyJisyoRW) {
      await this.#userDictionary.save();
    }
  }

  async purgeCandidate(type: HenkanType, word: string, candidate: string) {
    this.#userDictionary.purgeCandidate(type, word, candidate);
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

const encodingNames: Record<string, string> = {
  "EUCJP": "euc-jp",
  "SJIS": "shift-jis",
  "UTF8": "utf-8",
};

export async function load(
  globalDictionaryConfig: (string | [string, string])[],
  userDictionaryPath: UserDictionaryPath,
  skkServer?: SkkServer,
): Promise<Library> {
  const globalDictionaries = await Promise.all(
    globalDictionaryConfig.map(async ([path, encodingName]) => {
      if (encodingName === "") {
        const data = await Deno.readFile(path);
        encodingName = encodingNames[String(encoding.detect(data))];
      }
      const dict = new SKKDictionary();
      try {
        await dict.load(path, encodingName);
      } catch (e) {
        console.error("globalDictionary loading failed");
        console.error(`at ${path}`);
        if (config.debug) {
          console.error(e);
        }
      }
      return dict;
    }),
  );
  const userDictionary = new UserDictionary();
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
  const dictionaries = globalDictionaries.map((d) => wrapDictionary(d))
    .concat(skkServer ? [skkServer] : []);
  return new Library(dictionaries, userDictionary);
}
