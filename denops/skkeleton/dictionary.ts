import { config } from "./config.ts";
import { JpNum } from "./deps/japanese_numeral.ts";
import { RomanNum } from "./deps/roman.ts";
import { zip } from "./deps/std/collections.ts";
import type { CompletionData, RankData } from "./types.ts";
import { SkkDictionary } from "./sources/skk_dictionary.ts";
import { DenoKvDictionary } from "./sources/deno_kv.ts";
import {
  UserDictionary,
  UserDictionaryPath,
} from "./sources/user_dictionary.ts";
import { SkkServer } from "./sources/skk_server.ts";
import { GoogleJapaneseInput } from "./sources/google_japanese_input.ts";

export const okuriAriMarker = ";; okuri-ari entries.";
export const okuriNasiMarker = ";; okuri-nasi entries.";

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
  getHenkanResult(type: HenkanType, word: string): Promise<string[]>;
  getCompletionResult(prefix: string, feed: string): Promise<CompletionData>;
}

export class NumberConvertWrapper implements Dictionary {
  #inner: Dictionary;

  constructor(dict: Dictionary) {
    this.#inner = dict;
  }

  async getHenkanResult(type: HenkanType, word: string): Promise<string[]> {
    const realWord = word.replaceAll(/[0-9]+/g, "#");
    const candidate = await this.#inner.getHenkanResult(type, realWord);
    if (word === realWord) {
      return candidate;
    } else {
      candidate.unshift(...(await this.#inner.getHenkanResult(type, word)));
      return candidate.map((c) => convertNumber(c, word));
    }
  }

  async getCompletionResult(
    prefix: string,
    feed: string,
  ): Promise<CompletionData> {
    const realPrefix = prefix.replaceAll(/[0-9]+/g, "#");
    const candidates = await this.#inner.getCompletionResult(realPrefix, feed);
    if (prefix === realPrefix) {
      return candidates;
    } else {
      candidates.unshift(
        ...(await this.#inner.getCompletionResult(prefix, feed)),
      );
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

export type HenkanType = "okuriari" | "okurinasi";

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

  async getHenkanResult(type: HenkanType, word: string): Promise<string[]> {
    if (config.immediatelyDictionaryRW) {
      await this.load();
    }
    const merged = new Set<string>();
    for (const dic of this.#dictionaries) {
      for (const c of await dic.getHenkanResult(type, word)) {
        merged.add(c);
      }
    }
    return Array.from(merged);
  }

  async getCompletionResult(
    prefix: string,
    feed: string,
  ): Promise<CompletionData> {
    if (config.immediatelyDictionaryRW) {
      await this.load();
    }
    const collector = new Map<string, Set<string>>();
    if (prefix.length == 0) {
      return [];
    } else if (prefix.length == 1) {
      for (const dic of this.#dictionaries) {
        gatherCandidates(collector, [[
          prefix,
          await dic.getHenkanResult("okurinasi", prefix),
        ]]);
      }
    } else {
      for (const dic of this.#dictionaries) {
        gatherCandidates(
          collector,
          await dic.getCompletionResult(prefix, feed),
        );
      }
    }
    return Array.from(collector.entries())
      .map(([kana, cset]) => [kana, Array.from(cset)]);
  }

  getRanks(prefix: string): RankData {
    return this.#userDictionary.getRanks(prefix);
  }

  async registerHenkanResult(
    type: HenkanType,
    word: string,
    candidate: string,
  ) {
    this.#userDictionary.registerHenkanResult(type, word, candidate);
    if (config.immediatelyDictionaryRW) {
      await this.#userDictionary.save();
    }
  }

  async purgeCandidate(type: HenkanType, word: string, candidate: string) {
    this.#userDictionary.purgeCandidate(type, word, candidate);
    if (config.immediatelyDictionaryRW) {
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
  globalDictionaryConfig: (string | [string, string])[],
  userDictionaryPath: UserDictionaryPath,
): Promise<Library> {
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

  const dictionaries: Dictionary[] = [];
  for (const source of config.sources) {
    if (source === "skk_dictionary") {
      const globalDictionaries = await Promise.all(
        globalDictionaryConfig.map(async ([path, encodingName]) => {
          try {
            const dict = new SkkDictionary();
            await dict.load(path, encodingName);
            return dict;
          } catch (e) {
            console.error("globalDictionary loading failed");
            console.error(`at ${path}`);
            if (config.debug) {
              console.error(e);
            }
            return undefined;
          }
        }),
      );

      for (const d of globalDictionaries) {
        if (d) {
          dictionaries.push(wrapDictionary(d));
        }
      }
    } else if (source === "deno_kv") {
      const globalDictionaries = await Promise.all(
        globalDictionaryConfig.map(async ([path, encodingName]) => {
          try {
            const dict = await DenoKvDictionary.create(path, encodingName);
            await dict.load();
            return dict;
          } catch (e) {
            console.error("globalDictionary loading failed");
            console.error(`at ${path}`);
            if (config.debug) {
              console.error(e);
            }
            return undefined;
          }
        }),
      );

      for (const d of globalDictionaries) {
        if (d) {
          dictionaries.push(wrapDictionary(d));
        }
      }
    } else if (source === "skk_server") {
      const skkServer = new SkkServer({
        hostname: config.skkServerHost,
        port: config.skkServerPort,
        requestEnc: config.skkServerReqEnc,
        responseEnc: config.skkServerResEnc,
      });

      try {
        skkServer.connect();
      } catch (e) {
        if (config.debug) {
          console.log("connecting to skk server is failed");
          console.log(e);
        }
      }

      dictionaries.push(skkServer);
    } else if (source === "google_japanese_input") {
      dictionaries.push(new GoogleJapaneseInput());
    } else {
      console.error(`Invalid source name: ${source}`);
    }
  }

  return new Library(dictionaries, userDictionary);
}
