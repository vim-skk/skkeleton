import { config } from "./config.ts";
import { encoding, isArray, isObject, isString } from "./deps.ts";
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

function encode(str: string, enc: "euc-jp" | "utf-8" = "euc-jp"): Uint8Array {
  const encodingCompat = {
    "euc-jp": "EUCJP" as const,
    "utf-8": "UTF8" as const,
  };
  const array = Uint8Array.from(str.split("").map(c => c.charCodeAt(0)))
  const buffer = encoding.convert(array, encodingCompat[enc]);
  return new Uint8Array(buffer);
}

function decode(str: Uint8Array, enc = "euc-jp"): string {
  const decoder = new TextDecoder(enc);
  return decoder.decode(str);
}

export class RemoteJisyo {
  #conn: Deno.Conn | undefined;
  async connect(options: Deno.ConnectOptions) {
    this.#conn = await Deno.connect(options);
  }
  async getCandidate(word: string): Promise<string[]> {
    if (!this.#conn) return [];
    await this.#conn.write(encode(`1${word} `, "euc-jp"));
    const res = new Uint8Array(1024);
    await this.#conn.read(res);
    const str = decode(res, "euc-jp");
    return (str.at(0) === "4") ? [] : str.split("/").slice(1, -1);
  }
  async getCandidates(word: string): Promise<[string, string[]][]> {
    if (!this.#conn) return [];
    await this.#conn.write(encode(`4${word} `, "euc-jp"));
    const res = new Uint8Array(1024);
    await this.#conn.read(res);
    const result: [string, string[]][] = [];
    for (const entry of decode(res, "euc-jp").split("/").slice(1, -1)) {
      await this.#conn.write(encode(`1${entry} `, "euc-jp"));
      const res = new Uint8Array(1024);
      await this.#conn.read(res);
      result.push([entry, decode(res, "euc-jp").split("/").slice(1, -1)]);
    }
    return result;
  }
  close() {
    this.#conn?.close();
  }
}

export class Library {
  #globalJisyo: Jisyo;
  #userJisyo: Jisyo;
  #userJisyoPath: string;
  #userJisyoTimestamp = -1;
  #remoteJisyo: RemoteJisyo;

  constructor(
    globalJisyo?: Jisyo,
    userJisyo?: Jisyo,
    userJisyoPath?: string,
    remoteJisyo = new RemoteJisyo(),
  ) {
    this.#globalJisyo = globalJisyo ?? newJisyo();
    this.#userJisyo = userJisyo ?? newJisyo();
    this.#userJisyoPath = userJisyoPath ?? "";
    this.#remoteJisyo = remoteJisyo;
  }

  async getCandidate(type: HenkanType, word: string): Promise<string[]> {
    const userCandidates = this.#userJisyo[type][word] ?? [];
    const globalCandidates = this.#globalJisyo[type][word] ?? [];
    const remotecandidates = await this.#remoteJisyo.getCandidate(word);
    return Promise.resolve(
      Array.from(
        new Set(userCandidates.concat(globalCandidates, remotecandidates)),
      ),
    );
  }

  async getCandidates(prefix: string): Promise<[string, string[]][]> {
    if (prefix.length < 2) {
      return Promise.resolve([]);
    }
    const table: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(this.#globalJisyo.okurinasi)) {
      if (key.startsWith(prefix)) {
        table[key] = Array.from(new Set(value.concat(table[key])));
      }
    }
    for (const [key, value] of Object.entries(this.#userJisyo.okurinasi)) {
      if (key.startsWith(prefix)) {
        table[key] = Array.from(new Set(value.concat(table[key])));
      }
    }
    for (const [key, value] of await this.#remoteJisyo.getCandidates(prefix)) {
      table[key] = Array.from(new Set(value.concat(table[key])));
    }
    return Promise.resolve(
      Object.entries(table).sort((a, b) => a[0].localeCompare(b[0])),
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
  remoteJisyoOptions?: Deno.ConnectOptions,
): Promise<Library> {
  let globalJisyo = newJisyo();
  let userJisyo = newJisyo();
  const remoteJisyo = new RemoteJisyo();
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
  try {
    if (remoteJisyoOptions) {
      remoteJisyo.connect(remoteJisyoOptions);
    }
  } catch (e) {
    if (config.debug) {
      console.log("remoteJisyo loading failed");
      console.log(e);
    }
  }
  return new Library(globalJisyo, userJisyo, userJisyoPath, remoteJisyo);
}

export const currentLibrary = new Cell(() => new Library());
