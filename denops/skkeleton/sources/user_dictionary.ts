import { config } from "../config.ts";
import { getKanaTable } from "../kana.ts";
import type { CompletionData, RankData } from "../types.ts";
import {
  Dictionary as BaseDictionary,
  HenkanType,
  okuriAriMarker,
  okuriNasiMarker,
  Source as BaseSource,
  UserDictionary,
  UserDictionaryPath,
} from "../dictionary.ts";
import { wrap } from "../deps/iterator_helpers.ts";
import { assert, is } from "../deps/unknownutil.ts";

export class Source implements BaseSource {
  async getDictionaries(): Promise<BaseDictionary[]> {
    return [await this.getUserDictionary()];
  }

  async getUserDictionary(): Promise<UserDictionary> {
    const userDictionary = new Dictionary();
    try {
      await userDictionary.load({
        path: config.userDictionary,
        rankPath: config.completionRankFile,
      });
    } catch (e) {
      if (config.debug) {
        console.log("userDictionary loading failed");
        console.log(e);
      }
      // do nothing
    }

    return userDictionary;
  }
}

export class Dictionary implements UserDictionary {
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

  getHenkanResult(type: HenkanType, word: string): Promise<string[]> {
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

  getCompletionResult(prefix: string, feed: string): Promise<CompletionData> {
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

  registerHenkanResult(type: HenkanType, word: string, candidate: string) {
    if (candidate === "") {
      return Promise.resolve();
    }
    const target = type === "okuriari" ? this.#okuriAri : this.#okuriNasi;
    const oldCandidate = target.get(word) ?? [];
    target.set(
      word,
      Array.from(new Set([candidate, ...oldCandidate])),
    );
    this.#rank.set(candidate, Date.now());
    this.#cachedPrefix = "";

    return Promise.resolve();
  }

  purgeCandidate(type: HenkanType, word: string, candidate: string) {
    const target = type === "okuriari" ? this.#okuriAri : this.#okuriNasi;
    const newCandidate = (target.get(word) ?? []).filter((c) => c != candidate);
    if (newCandidate.length > 0) {
      target.set(word, newCandidate);
    } else {
      target.delete(word);
    }

    return Promise.resolve();
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
    assert(rankData, is.ArrayOf(is.String));
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
        `warning(skkeleton): can't write userDictionary to ${path}`,
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
