import { config } from "../config.ts";
import {
  Dictionary as BaseDictionary,
  HenkanType,
  okuriAriMarker,
  okuriNasiMarker,
  Source as BaseSource,
  wrapDictionary,
} from "../dictionary.ts";
import { getKanaTable } from "../kana.ts";
import type { CompletionData } from "../types.ts";
import { readFileWithEncoding } from "../util.ts";
import jisyoschema from "jisyo/schema" with { type: "json" };

import jsonschema from "jsonschema";

import { decode as msgpackDecode } from "@std/msgpack/decode";
import { parse as yamlParse } from "@std/yaml/parse";

interface Jisyo {
  okuri_ari: Record<string, string[]>;
  okuri_nasi: Record<string, string[]>;
}

export class Source implements BaseSource {
  getDictionaries(): Promise<BaseDictionary[]> {
    return Promise.resolve(
      config.globalDictionaries.map(([path, encodingName]) =>
        wrapDictionary(Dictionary.fromFile(path, encodingName))
      ),
    );
  }
}

export class Dictionary implements BaseDictionary {
  #okuriAri: Map<string, string[]>;
  #okuriNasi: Map<string, string[]>;

  #cachedCandidates: Map<string, CompletionData>;
  #path: string | undefined;
  #encoding: string;
  #loadPromise: Promise<void> | undefined;

  constructor(
    okuriAri?: Map<string, string[]>,
    okuriNasi?: Map<string, string[]>,
    path?: string,
    encoding = "",
  ) {
    this.#okuriAri = okuriAri ?? new Map();
    this.#okuriNasi = okuriNasi ?? new Map();
    this.#cachedCandidates = new Map();
    this.#path = path;
    this.#encoding = encoding;
  }

  static fromFile(path: string, encoding: string): Dictionary {
    return new Dictionary(undefined, undefined, path, encoding);
  }

  async getHenkanResult(type: HenkanType, word: string): Promise<string[]> {
    await this.ensureLoaded();
    const target = type === "okuriari" ? this.#okuriAri : this.#okuriNasi;
    return target.get(word) ?? [];
  }

  async getCompletionResult(
    prefix: string,
    feed: string,
  ): Promise<CompletionData> {
    await this.ensureLoaded();
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
    return candidates;
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

  async load(path?: string, encoding?: string) {
    if (path !== undefined) {
      this.#path = path;
      this.#encoding = encoding ?? "";
      this.#loadPromise = undefined;
    }
    await this.ensureLoaded();
    return this;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.#path || this.#loadPromise === undefined) {
      if (!this.#path) {
        return;
      }
      this.#loadPromise = this.readFile();
    }
    await this.#loadPromise;
  }

  private async readFile(): Promise<void> {
    const path = this.#path!;
    if (path.endsWith(".yaml") || path.endsWith(".yml")) {
      this.loadYaml(await Deno.readTextFile(path));
    } else if (path.endsWith(".json")) {
      this.loadJson(await Deno.readTextFile(path));
    } else if (path.endsWith(".mpk")) {
      this.loadMsgpack(await Deno.readFile(path));
    } else {
      this.loadString(await readFileWithEncoding(path, this.#encoding));
    }
  }

  private loadJson(data: string) {
    const jisyo = JSON.parse(data) as Jisyo;
    const validator = new jsonschema.Validator();
    const result = validator.validate(jisyo, jisyoschema);
    if (!result.valid) {
      for (const error of result.errors) {
        throw Error(error.message);
      }
    }
    this.#okuriAri = new Map(Object.entries(jisyo.okuri_ari));
    this.#okuriNasi = new Map(Object.entries(jisyo.okuri_nasi));
  }

  private loadYaml(data: string) {
    const jisyo = yamlParse(data) as Jisyo;
    const validator = new jsonschema.Validator();
    const result = validator.validate(jisyo, jisyoschema);
    if (!result.valid) {
      for (const error of result.errors) {
        throw Error(error.message);
      }
    }
    this.#okuriAri = new Map(Object.entries(jisyo.okuri_ari));
    this.#okuriNasi = new Map(Object.entries(jisyo.okuri_nasi));
  }

  private loadMsgpack(data: Uint8Array) {
    const jisyo = msgpackDecode(data) as unknown as Jisyo;
    const validator = new jsonschema.Validator();
    const result = validator.validate(jisyo, jisyoschema);
    if (!result.valid) {
      for (const error of result.errors) {
        throw Error(error.message);
      }
    }
    this.#okuriAri = new Map(Object.entries(jisyo.okuri_ari));
    this.#okuriNasi = new Map(Object.entries(jisyo.okuri_nasi));
  }

  private loadString(data: string) {
    this.#okuriAri = new Map();
    this.#okuriNasi = new Map();

    let mode: 0 | 1 | -1 = -1;
    const a: Map<string, string[]>[] = [this.#okuriAri, this.#okuriNasi];
    for (const line of data.split(/\n|\r\n/)) {
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
