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
import jisyoschema from "https://cdn.jsdelivr.net/gh/skk-dict/jisyo/schema/jisyo.schema.v0.0.0.json" with {
  type: "json",
};

import jsonschema from "jsonschema";

import { decode as msgpackDecode } from "@std/msgpack/decode";
import { parse as yamlParse } from "@std/yaml/parse";

interface Jisyo {
  okuri_ari: Record<string, string[]>;
  okuri_nasi: Record<string, string[]>;
}

const Encoder = new TextEncoder();
function encode(str: string): Uint8Array {
  return Encoder.encode(str);
}

function calcKeySize(keys: string[]): number {
  let size = 0;
  for (const key of keys) {
    const encoded = encode(key);
    size += encoded.reduce((acc, cur) => acc + (cur === 0x00 ? 2 : 1), 2);
  }
  return size;
}

export class Source implements BaseSource {
  async getDictionaries(): Promise<BaseDictionary[]> {
    const globalDictionaries = await Promise.all(
      config.globalDictionaries.map(async ([path, encodingName]) => {
        if (!Deno.Kv) {
          console.error("Deno KV initialization is failed");
          console.error(
            "'--unstable-kv' is needed for g:denops#server#deno_args.",
          );
          return undefined;
        }

        try {
          const dict = await Dictionary.create(path, encodingName);
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

    const dictionaries: BaseDictionary[] = [];
    for (const d of globalDictionaries) {
      if (d) {
        dictionaries.push(wrapDictionary(d));
      }
    }

    return dictionaries;
  }
}

export class Dictionary implements BaseDictionary {
  #db: Deno.Kv;
  #atm: Deno.AtomicOperation;
  #path: string;
  #encoding: string;

  constructor(
    database: Deno.Kv,
    path: string,
    encoding: string,
  ) {
    this.#db = database;
    this.#atm = database.atomic();
    this.#path = path;
    this.#encoding = encoding;
  }

  static async create(
    path: string,
    encoding: string,
    databasePath?: string,
  ): Promise<Dictionary> {
    return new Dictionary(
      await Deno.openKv(databasePath ?? config.databasePath),
      path,
      encoding,
    );
  }

  cleanup() {
    this.#db.close();
  }

  async getHenkanResult(
    type: HenkanType,
    word: string,
  ): Promise<string[]> {
    const result = await this.#db.get<string[]>([this.#path, type, ...word]);
    return result.value ?? [];
  }

  async getCompletionResult(
    prefix: string,
    feed: string,
  ): Promise<CompletionData> {
    const candidates: CompletionData = [];

    if (feed != "") {
      const table = getKanaTable();
      for (const [key, kanas] of table) {
        if (key.startsWith(feed) && kanas.length > 1) {
          const feedPrefix = prefix + (kanas as string[])[0];
          candidates.push(...await this.#searchByPrefix(feedPrefix));
        }
      }
    } else {
      candidates.push(...await this.#searchByPrefix(prefix));
    }

    candidates.sort((a, b) => a[0].localeCompare(b[0]));
    return Promise.resolve(candidates);
  }

  async #searchByPrefix(prefix: string): Promise<CompletionData> {
    const candidates: CompletionData = [];
    const exactlyMatch = await this.#db.get<string[]>([
      this.#path,
      "okurinasi",
      ...prefix,
    ]);
    if (exactlyMatch.value != null) {
      candidates.push([prefix, exactlyMatch.value]);
    }
    for await (
      const entry of this.#db.list<string[]>({
        prefix: [this.#path, "okurinasi", ...prefix],
      })
    ) {
      candidates.push([entry.key.slice(2).join(""), entry.value]);
    }
    return candidates;
  }

  async load(force = false) {
    const stat = await Deno.stat(this.#path);
    const mtime = stat.mtime?.getTime();
    if (
      !force && mtime &&
      (await this.#db.get([this.#path, "mtime"])).value === mtime
    ) {
      return this;
    }

    if (this.#path.endsWith(".json")) {
      await this.loadJson();
    } else if (this.#path.endsWith(".yaml") || this.#path.endsWith(".yml")) {
      await this.loadYaml();
    } else if (this.#path.endsWith(".mpk")) {
      await this.loadMsgpack();
    } else {
      await this.loadString();
    }
    await this.#atm.commit();
    await this.#db.set([this.#path, "mtime"], mtime);

    return this;
  }

  #mutationCount = 0;
  #totalKeySize = 0;
  private async setDatabase(
    type: HenkanType,
    k: string,
    v: string[],
  ) {
    const key = [this.#path, type, ...k];
    const keySize = calcKeySize(key);
    if (this.#mutationCount >= 1000 || this.#totalKeySize + keySize > 81920) {
      await this.#atm.commit();
      this.#atm = this.#db.atomic();
      this.#mutationCount = 0;
      this.#totalKeySize = 0;
    }
    this.#atm = this.#atm.set(key, v);
    this.#mutationCount++;
    this.#totalKeySize += keySize;
  }

  private async loadJson() {
    const data = await Deno.readTextFile(this.#path);
    const jisyo = JSON.parse(data) as Jisyo;
    const validator = new jsonschema.Validator();
    const result = validator.validate(jisyo, jisyoschema);
    if (!result.valid) {
      for (const error of result.errors) {
        throw Error(error.message);
      }
    }
    for (const [k, v] of Object.entries(jisyo.okuri_ari)) {
      await this.setDatabase("okuriari", k, v);
    }
    for (const [k, v] of Object.entries(jisyo.okuri_nasi)) {
      await this.setDatabase("okurinasi", k, v);
    }
  }

  private async loadYaml() {
    const data = await Deno.readTextFile(this.#path);
    const jisyo = yamlParse(data) as Jisyo;
    const validator = new jsonschema.Validator();
    const result = validator.validate(jisyo, jisyoschema);
    if (!result.valid) {
      for (const error of result.errors) {
        throw Error(error.message);
      }
    }
    for (const [k, v] of Object.entries(jisyo.okuri_ari)) {
      await this.setDatabase("okuriari", k, v);
    }
    for (const [k, v] of Object.entries(jisyo.okuri_nasi)) {
      await this.setDatabase("okurinasi", k, v);
    }
  }

  private async loadMsgpack() {
    const data = await Deno.readFile(this.#path);
    const jisyo = msgpackDecode(data) as unknown as Jisyo;
    const validator = new jsonschema.Validator();
    const result = validator.validate(jisyo, jisyoschema);
    if (!result.valid) {
      for (const error of result.errors) {
        throw Error(error.message);
      }
    }
    for (const [k, v] of Object.entries(jisyo.okuri_ari)) {
      await this.setDatabase("okuriari", k, v);
    }
    for (const [k, v] of Object.entries(jisyo.okuri_nasi)) {
      await this.setDatabase("okurinasi", k, v);
    }
  }

  private async loadString() {
    const data = await readFileWithEncoding(this.#path, this.#encoding);
    let mode: HenkanType | "" = "";
    for (const line of data.split("\n")) {
      if (line === okuriAriMarker) {
        mode = "okuriari";
        continue;
      }

      if (line === okuriNasiMarker) {
        mode = "okurinasi";
        continue;
      }

      if (mode === "") continue;

      const pos = line.indexOf(" ");
      if (pos !== -1) {
        await this.setDatabase(
          mode,
          line.substring(0, pos),
          line.slice(pos + 2, -1).split("/"),
        );
      }
    }
  }
}
