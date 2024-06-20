import { config } from "./config.ts";
import { toFileUrl } from "./deps/std/path.ts";
import { JpNum } from "./deps/japanese_numeral.ts";
import { RomanNum } from "./deps/roman.ts";
import { zip } from "./deps/std/collections.ts";
import type { CompletionData, RankData } from "./types.ts";

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

export type UserDictionaryPath = {
  path?: string;
  rankPath?: string;
};

export interface UserDictionary extends Dictionary {
  getHenkanResult(type: HenkanType, word: string): Promise<string[]>;
  getCompletionResult(prefix: string, feed: string): Promise<CompletionData>;
  getRanks(prefix: string): RankData;
  purgeCandidate(
    type: HenkanType,
    word: string,
    candidate: string,
  ): Promise<void>;
  registerHenkanResult(
    type: HenkanType,
    word: string,
    candidate: string,
  ): Promise<void>;
  load({ path, rankPath }: UserDictionaryPath): Promise<void>;
  save(): Promise<void>;
}

export interface Source {
  getDictionaries(): Promise<Dictionary[]>;
  getUserDictionary?(): Promise<UserDictionary>;
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

export type AffixType = "prefix" | "suffix";

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
  #userDictionary: UserDictionary | undefined;

  constructor(
    dictionaries?: Dictionary[],
    userDictionary?: UserDictionary,
  ) {
    this.#userDictionary = userDictionary ?? undefined;
    this.#dictionaries = [];
    if (userDictionary) {
      this.#dictionaries = [wrapDictionary(userDictionary)];
    }
    if (dictionaries) {
      this.#dictionaries = this.#dictionaries.concat(dictionaries);
    }
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
    if (!this.#userDictionary) {
      return [];
    }

    return this.#userDictionary.getRanks(prefix);
  }

  async registerHenkanResult(
    type: HenkanType,
    word: string,
    candidate: string,
  ) {
    if (!this.#userDictionary) {
      return;
    }

    this.#userDictionary.registerHenkanResult(type, word, candidate);
    if (config.immediatelyDictionaryRW) {
      await this.#userDictionary.save();
    }
  }

  async purgeCandidate(type: HenkanType, word: string, candidate: string) {
    if (!this.#userDictionary) {
      return;
    }

    this.#userDictionary.purgeCandidate(type, word, candidate);
    if (config.immediatelyDictionaryRW) {
      await this.#userDictionary.save();
    }
  }

  async load() {
    if (!this.#userDictionary) {
      return;
    }

    await this.#userDictionary.load({});
  }

  async save() {
    if (!this.#userDictionary) {
      return;
    }

    await this.#userDictionary.save();
  }
}

export async function load(paths: Record<string, string>): Promise<Library> {
  const userMod = await import(
    toFileUrl(paths["sources/user_dictionary"]).href
  );
  const userDictionary = await (new userMod.Source()).getUserDictionary();

  const dictionaries: Dictionary[] = [];
  for (const source of config.sources) {
    const key = `sources/${source}`;
    const path = paths[key];

    if (!path) {
      console.error(`Invalid source name: ${source}`);
      continue;
    }

    const mod = await import(toFileUrl(path).href);

    dictionaries.push(
      ...await (new mod.Source().getDictionaries()),
    );
  }

  return new Library(dictionaries, userDictionary);
}
