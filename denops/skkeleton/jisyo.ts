import { config } from "./config.ts";
import { isArray, isObject, isString } from "./deps.ts";
import { distinct } from "./deps/std/collections.ts";
import { Cell } from "./util.ts";

const okuriAriMarker = ";; okuri-ari entries.";
const okuriNasiMarker = ";; okuri-nasi entries.";

const lineRegexp = /^(\S+) \/(.*)\/$/;

export type Jisyo = {
  okuriari: Record<string, string[]>;
  okurinasi: Record<string, string[]>;
};

export type HenkanType = "okuriari" | "okurinasi";

export class Library {
  #globalJisyo: Jisyo;
  #userJisyo: Jisyo;
  #userJisyoPath: string;
  #userJisyoTimestamp = -1;

  constructor(globalJisyo?: Jisyo, userJisyo?: Jisyo, userJisyoPath?: string) {
    this.#globalJisyo = globalJisyo ?? newJisyo();
    this.#userJisyo = userJisyo ?? newJisyo();
    this.#userJisyoPath = userJisyoPath ?? "";
  }

  getCandidate(type: HenkanType, word: string): string[] {
    const candidates = this.#userJisyo[type][word] ?? [];
    const globalCandidates = this.#globalJisyo[type][word];
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

  getCandidates(prefix: string): [string, string[]][] {
    if (prefix.length < 2) {
      return [];
    }
    return Object.entries(this.#globalJisyo.okurinasi).filter((e) =>
      e[0].startsWith(prefix)
    );
  }

  registerCandidate(type: HenkanType, word: string, candidate: string) {
    if (!candidate) {
      return;
    }
    const candidates = distinct([
      candidate,
      ...this.#userJisyo[type][word] ?? [],
    ]);
    this.#userJisyo[type][word] = candidates;
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

export function decodeJisyo(data: string) {
  const lines = data.split("\n");

  const okuriAriIndex = lines.indexOf(okuriAriMarker);
  const okuriNasiIndex = lines.indexOf(okuriNasiMarker);

  const okuriAriEntries = lines.slice(okuriAriIndex + 1, okuriNasiIndex).map(
    (s) => s.match(lineRegexp),
  ).filter((m) => m).map((m) => [m![1], m![2].split("/")]);
  const okuriNasiEntries = lines.slice(okuriNasiIndex + 1, lines.length).map(
    (s) => s.match(lineRegexp),
  ).filter((m) => m).map((m) => [m![1], m![2].split("/")]);

  const jisyo: Jisyo = {
    okuriari: Object.fromEntries(okuriAriEntries),
    okurinasi: Object.fromEntries(okuriNasiEntries),
  };

  return jisyo;
}

/**
 * load SKK jisyo from `path`
 */
export async function loadJisyo(
  path: string,
  jisyoEncoding: string,
): Promise<Jisyo> {
  const decoder = new TextDecoder(jisyoEncoding);
  return decodeJisyo(decoder.decode(await Deno.readFile(path)));
}

function linesToString(entries: [string, string[]][]): string[] {
  return entries.sort((a, b) => a[0].localeCompare(b[0])).map((entry) =>
    `${entry[0]} /${entry[1].join("/")}/`
  );
}

/**
 * encode jisyo to SKK style
 */
export function encodeJisyo(jisyo: Jisyo): string {
  return [
    [okuriAriMarker],
    linesToString(Object.entries(jisyo.okuriari)),
    [okuriNasiMarker],
    linesToString(Object.entries(jisyo.okurinasi)),
    [""], // The text file must end with a new line
  ].flat().join("\n");
}

function newJisyo(): Jisyo {
  return {
    okuriari: {},
    okurinasi: {},
  };
}

export function ensureJisyo(x: unknown): asserts x is Jisyo {
  const pred = (x: unknown): x is Array<string> => isArray(x, isString);
  if (
    isObject(x) && isObject(x.okuriari, pred) && isObject(x.okurinasi, pred)
  ) {
    return;
  }
  throw new Error("corrupt jisyo detected");
}

export async function load(
  globalJisyoPath: string,
  userJisyoPath: string,
  jisyoEncoding = "euc-jp",
): Promise<Library> {
  let globalJisyo = newJisyo();
  let userJisyo = newJisyo();
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
      jisyoEncoding,
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
