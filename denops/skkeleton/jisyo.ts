import { config } from "./config.ts";
import { encoding, isArray, isObject, isString, iter } from "./deps.ts";
import { distinct } from "./deps/std/collections.ts";
import { Cell } from "./util.ts";
import type { Encoding, SkkServerOptions } from "./types.ts";
import { Encode } from "./types.ts";

const okuriAriMarker = ";; okuri-ari entries.";
const okuriNasiMarker = ";; okuri-nasi entries.";

const lineRegexp = /^(\S+) \/(.*)\/$/;

export type Jisyo = {
  okuriari: Record<string, string[]>;
  okurinasi: Record<string, string[]>;
};

export type HenkanType = "okuriari" | "okurinasi";

function encode(str: string, enc: Encoding): Uint8Array {
  const utf8Encoder = new TextEncoder();
  const utf8Bytes = utf8Encoder.encode(str);
  const eucBytesArray = encoding.convert(utf8Bytes, Encode[enc], "UTF8");
  const eucBytes = Uint8Array.from(eucBytesArray);
  return eucBytes;
}

function decode(str: Uint8Array, enc: Encoding): string {
  const decoder = new TextDecoder(enc);
  return decoder.decode(str);
}

export class SkkServer {
  #conn: Deno.Conn | undefined;
  responseEnc: Encoding;
  requestEnc: Encoding;
  connectOptions: Deno.ConnectOptions;
  constructor(opts: SkkServerOptions) {
    this.requestEnc = opts.requestEnc;
    this.responseEnc = opts.responseEnc;
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
    await this.#conn.write(encode(`1${word} `, this.requestEnc));
    const result: string[] = [];
    for await (const res of iter(this.#conn)) {
      const str = decode(res, this.responseEnc);
      result.push(...(str.at(0) === "4") ? [] : str.split("/").slice(1, -1));

      if (str.endsWith("\n")) {
        break;
      }
    }
    return result;
  }
  close() {
    this.#conn?.write(encode("0", this.requestEnc));
    this.#conn?.close();
  }
}

export class Library {
  #globalJisyo: Jisyo;
  #userJisyo: Jisyo;
  #userJisyoPath: string;
  #userJisyoTimestamp = -1;
  #skkServer: SkkServer | undefined;

  constructor(
    globalJisyo?: Jisyo,
    userJisyo?: Jisyo,
    userJisyoPath?: string,
    skkServer?: SkkServer,
  ) {
    this.#globalJisyo = globalJisyo ?? newJisyo();
    this.#userJisyo = userJisyo ?? newJisyo();
    this.#userJisyoPath = userJisyoPath ?? "";
    this.#skkServer = skkServer;
  }

  async getCandidate(type: HenkanType, word: string): Promise<string[]> {
    const userCandidates = this.#userJisyo[type][word] ?? [];
    const merged = userCandidates.slice();
    const globalCandidates = this.#globalJisyo[type][word];
    const remoteCandidates = await this.#skkServer?.getCandidate(word);
    if (globalCandidates) {
      for (const c of globalCandidates) {
        if (!merged.includes(c)) {
          merged.push(c);
        }
      }
    }
    if (remoteCandidates) {
      for (const c of remoteCandidates) {
        if (!merged.includes(c)) {
          merged.push(c);
        }
      }
    }
    return merged;
  }

  getCandidates(prefix: string): [string, string[]][] {
    if (prefix.length < 2) {
      return [];
    }
    const globalJisyo = this.#globalJisyo.okurinasi;
    const userJisyo = this.#userJisyo.okurinasi;
    const user = Object.entries(userJisyo).filter((e) =>
      !globalJisyo[e[0]] && e[0].startsWith(prefix)
    );
    const global: [string, string[]][] = Object.entries(
      this.#globalJisyo.okurinasi,
    ).filter((e) => e[0].startsWith(prefix)).map((e) => {
      const ue = this.#userJisyo.okurinasi[e[0]];
      if (ue) {
        return [e[0], distinct(ue.concat(e[1]))];
      } else {
        return e;
      }
    });
    return [...user, ...global].sort((a, b) => a[0].localeCompare(b[0]));
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
  skkServer?: SkkServer,
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
    if (skkServer) {
      skkServer.connect();
    }
  } catch (e) {
    if (config.debug) {
      console.log("connecting to skk server is failed");
      console.log(e);
    }
  }
  return new Library(globalJisyo, userJisyo, userJisyoPath, skkServer);
}

export const currentLibrary = new Cell(() => new Library());
