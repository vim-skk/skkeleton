import { config } from "./config.ts";
import { Cell } from "./util.ts";

const okuriAriMarker = ";; okuri-ari entries.";
const okuriNasiMarker = ";; okuri-nasi entries.";

const lineRegexp = /^(\S+) \/(.*)\/$/;

interface Jisyo {
  getCandidate(type: HenkanType, word: string): Promise<string[]>;
  getCandidates(word: string): Promise<[string, string[]][]>;
}

export class LocalJisyo implements Jisyo {
  #okuriari: Map<string, string[]>;
  #okurinasi: Map<string, string[]>;
  constructor(
    okuriari?: Map<string, string[]>,
    okurinasi?: Map<string, string[]>,
  ) {
    this.#okuriari = okuriari ?? new Map();
    this.#okurinasi = okurinasi ?? new Map();
  }
  getCandidate(type: HenkanType, word: string): Promise<string[]> {
    const target = type === "okuriari" ? this.#okuriari : this.#okurinasi;
    return Promise.resolve(target.get(word) ?? []);
  }
  getCandidates(prefix: string): Promise<[string, string[]][]> {
    const candidates = new Map<string, string[]>();
    for (const [key, value] of this.#okurinasi) {
      if (key.startsWith(prefix)) {
        candidates.set(key, value);
      }
    }
    return Promise.resolve(Array.from(candidates.entries()));
  }
  registerCandidate(type: HenkanType, word: string, candidate: string) {
    const target = type === "okuriari" ? this.#okuriari : this.#okurinasi;
    target.set(
      word,
      Array.from(new Set([candidate, ...target.get(word) ?? []])),
    );
  }
  toString(): string {
    return [
      [okuriAriMarker],
      linesToString(Array.from(this.#okuriari.entries())),
      [okuriNasiMarker],
      linesToString(Array.from(this.#okurinasi.entries())),
      [""], // The text file must end with a new line
    ].flat().join("\n");
  }
}

export function encodeJisyo(jisyo: LocalJisyo) {
  return jisyo.toString();
}

export type HenkanType = "okuriari" | "okurinasi";

export class Library {
  #globalJisyo: LocalJisyo;
  #userJisyo: LocalJisyo;
  #userJisyoPath: string;
  #userJisyoTimestamp = -1;

  constructor(
    globalJisyo?: LocalJisyo,
    userJisyo?: LocalJisyo,
    userJisyoPath?: string,
  ) {
    this.#globalJisyo = globalJisyo ?? new LocalJisyo();
    this.#userJisyo = userJisyo ?? new LocalJisyo();
    this.#userJisyoPath = userJisyoPath ?? "";
  }

  async getCandidate(type: HenkanType, word: string): Promise<string[]> {
    const candidates = await this.#userJisyo.getCandidate(type, word);
    const globalCandidates = await this.#globalJisyo.getCandidate(type, word);
    if (globalCandidates) {
      const merged = candidates.slice();
      for (const c of globalCandidates) {
        if (!merged.includes(c)) {
          merged.push(c);
        }
      }
      return merged;
    }
    return candidates;
  }

  async getCandidates(prefix: string): Promise<[string, string[]][]> {
    if (prefix.length < 2) {
      return [];
    }
    const candidates = new Map<string, string[]>();
    for (const [key, value] of await this.#userJisyo.getCandidates(prefix)) {
      candidates.set(
        key,
        Array.from(new Set([...candidates.get(key) ?? [], ...value])),
      );
    }
    for (const [key, value] of await this.#globalJisyo.getCandidates(prefix)) {
      candidates.set(
        key,
        Array.from(new Set([...candidates.get(key) ?? [], ...value])),
      );
    }
    return Array.from(candidates.entries());
  }

  registerCandidate(type: HenkanType, word: string, candidate: string) {
    if (!candidate) {
      return;
    }
    this.#userJisyo.registerCandidate(type, word, candidate);
    if (config.immediatelyJisyoRW) {
      this.saveJisyo();
    }
  }

  async loadJisyo() {
    if (this.#userJisyoPath) {
      try {
        const stat = await Deno.stat(this.#userJisyoPath);
        const time = stat.mtime?.getTime() ?? -1;
        if (time === this.#userJisyoTimestamp) {
          return;
        }
        this.#userJisyoTimestamp = time;
        this.#userJisyo = decodeJisyo(
          await Deno.readTextFile(this.#userJisyoPath),
        );
      } catch {
        // do nothing
      }
    }
  }

  async saveJisyo() {
    if (this.#userJisyoPath) {
      await Deno.writeTextFile(
        this.#userJisyoPath,
        encodeJisyo(this.#userJisyo),
      );
      const stat = await Deno.stat(this.#userJisyoPath);
      const time = stat.mtime?.getTime() ?? -1;
      this.#userJisyoTimestamp = time;
    }
  }
}

export function decodeJisyo(data: string): LocalJisyo {
  const lines = data.split("\n");

  const okuriAriIndex = lines.indexOf(okuriAriMarker);
  const okuriNasiIndex = lines.indexOf(okuriNasiMarker);

  const okuriAriEntries = lines.slice(okuriAriIndex + 1, okuriNasiIndex).map(
    (s) => s.match(lineRegexp),
  ).filter((m) => m).map((m) =>
    [m![1], m![2].split("/")] as [string, string[]]
  );
  const okuriNasiEntries = lines.slice(okuriNasiIndex + 1, lines.length).map(
    (s) => s.match(lineRegexp),
  ).filter((m) => m).map((m) =>
    [m![1], m![2].split("/")] as [string, string[]]
  );

  return new LocalJisyo(
    new Map(okuriAriEntries),
    new Map(okuriNasiEntries),
  );
}

/**
 * load SKK jisyo from `path`
 */
export async function loadJisyo(
  path: string,
  jisyoEncoding: string,
): Promise<LocalJisyo> {
  const decoder = new TextDecoder(jisyoEncoding);
  return decodeJisyo(decoder.decode(await Deno.readFile(path)));
}

function linesToString(entries: [string, string[]][]): string[] {
  return entries.sort((a, b) => a[0].localeCompare(b[0])).map((entry) =>
    `${entry[0]} /${entry[1].join("/")}/`
  );
}

export function ensureJisyo(x: unknown): asserts x is Jisyo {
  if (x instanceof LocalJisyo) {
    return;
  }
  throw new Error("corrupt jisyo detected");
}

export async function load(
  globalJisyoPath: string,
  userJisyoPath: string,
  jisyoEncoding = "euc-jp",
): Promise<Library> {
  let globalJisyo = new LocalJisyo();
  let userJisyo = new LocalJisyo();
  try {
    globalJisyo = await loadJisyo(
      globalJisyoPath,
      jisyoEncoding,
    );
  } catch (e) {
    console.error("globalJisyo loading failed");
    console.error(`at ${globalJisyoPath}`);
    if (config.debug) {
      console.error(e);
    }
  }
  try {
    userJisyo = await loadJisyo(
      userJisyoPath,
      "utf-8",
    );
  } catch (e) {
    if (config.debug) {
      console.log("userJisyo loading failed");
      console.log(e);
    }
    // do nothing
  }
  return new Library(globalJisyo, userJisyo, userJisyoPath);
}

export const currentLibrary = new Cell(() => new Library());
