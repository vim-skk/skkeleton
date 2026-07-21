import { config } from "../config.ts";
import {
  Dictionary as BaseDictionary,
  HenkanType,
  Source as BaseSource,
} from "../dictionary.ts";
import { getKanaTable } from "../kana.ts";
import { Encode } from "../types.ts";
import type { CompletionData, Encoding, SkkServerOptions } from "../types.ts";

// NOTE: import * as encoding does not work!
import encoding from "encoding-japanese";

import { TextLineStream } from "@std/streams/text-line-stream";

type Server = {
  conn: Deno.Conn;
  readCallback: (result: string) => void;
  writer: WritableStreamDefaultWriter<Uint8Array>;
};

export class Source implements BaseSource {
  async getDictionaries(): Promise<BaseDictionary[]> {
    const skkServer = new Dictionary({
      hostname: config.skkServerHost,
      port: config.skkServerPort,
      requestEnc: config.skkServerReqEnc,
      responseEnc: config.skkServerResEnc,
      timeout: config.skkServerTimeout,
    });

    try {
      await skkServer.connect();
    } catch (e) {
      if (config.debug) {
        console.log("connecting to skk server is failed");
        console.log(e);
      }
    }

    return [skkServer];
  }
}

export class Dictionary implements BaseDictionary {
  #server: Server | undefined;
  // Serializes socket round-trips. This connection is not multiplexed and has
  // only one slot for `readCallback`, so two in-flight requests overwrite each
  // other and a response gets tied to the wrong request (e.g. a completion
  // query receiving conversion candidates). Chaining every round-trip onto this
  // Promise keeps at most one round-trip in flight at a time.
  #queue: Promise<unknown> = Promise.resolve();
  // Grace period for a single request/response round-trip. On timeout we give
  // up and drop the connection so a single lost response can't deadlock the
  // serialized queue above. skkserv normally replies almost instantly, but a
  // networked skkserv falling back to a slow dictionary lookup is the realistic
  // worst case, so this is configurable via `skkServerTimeout`.
  #timeout: number;
  responseEncoding: Encoding;
  requestEncoding: Encoding;
  connectOptions: Deno.ConnectOptions;

  constructor(opts: SkkServerOptions) {
    this.requestEncoding = opts.requestEnc;
    this.responseEncoding = opts.responseEnc;
    this.#timeout = opts.timeout;
    this.connectOptions = {
      hostname: opts.hostname,
      port: opts.port,
    };
  }

  /** Runs `task` only after everything already queued has settled. */
  #enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(task, task);
    // Continue the chain whether task fulfills or rejects, and swallow the
    // result here so an unhandled rejection can't leak from the tail of the
    // queue.
    this.#queue = run.then(() => {}, () => {});
    return run;
  }

  /**
   * Sends one command and resolves with its (single-line) response. Must be
   * called only from within #enqueue so the shared `readCallback` never races.
   * Resolves with "" on connection failure or timeout.
   */
  async #request(command: string): Promise<string> {
    await this.connect();
    if (!this.#server) return "";

    const { promise, resolve } = Promise.withResolvers<string>();
    const timer = setTimeout(() => {
      // The server may still send this response later; on a shared socket it
      // would be misattributed to the next request and reintroduce the desync
      // this queue prevents. Drop the connection so the in-flight response is
      // discarded, and connect() re-establishes it on the next round-trip.
      this.#discard();
      resolve("");
    }, this.#timeout);
    this.#server.readCallback = (response: string) => {
      clearTimeout(timer);
      resolve(response);
    };

    await this.write(command);
    return await promise;
  }

  // Tears the connection down synchronously so that, by the time the next
  // request calls connect(), `#server` is already gone and a fresh socket is
  // opened. Any response still in flight on the old socket is dropped instead
  // of leaking into the next request's `readCallback`.
  #discard() {
    this.#server?.conn.close();
    this.#server = undefined;
  }

  async connect(close = false) {
    if (close) {
      await this.close();
    }
    if (this.#server != null) {
      return;
    }
    const conn = await Deno.connect(this.connectOptions);
    conn.readable
      .pipeThrough(new TextDecoderStream(this.responseEncoding))
      .pipeThrough(new TextLineStream())
      .pipeTo(
        new WritableStream({
          write: (response: string) => {
            this.#server?.readCallback(response);
          },
        }),
      ).catch(() => {
        // Closing the socket (e.g. from #discard() on timeout) interrupts the
        // pending read and rejects this pipe with "operation canceled". That is
        // expected teardown, so swallow it instead of leaking an unhandled
        // rejection.
      }).finally(() => {
        this.#server = undefined;
      });
    const writer = conn.writable.getWriter();
    this.#server = {
      conn,
      readCallback: () => {},
      writer,
    };
  }

  getHenkanResult(_type: HenkanType, word: string): Promise<string[]> {
    return this.#enqueue(async () => {
      const response = await this.#request(`1${word} `);
      return response.at(0) === "1" ? response.split("/").slice(1, -1) : [];
    });
  }

  async getCompletionResult(
    prefix: string,
    feed: string,
  ): Promise<CompletionData> {
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
      candidates.push([
        midashi,
        await this.getHenkanResult("okurinasi", midashi),
      ]);
    }

    return candidates;
  }

  private getMidashis(prefix: string): Promise<string[]> {
    // Get midashis from prefix
    return this.#enqueue(async () => {
      const response = await this.#request(`4${prefix} `);
      return response.at(0) === "1" ? response.split(/\/|\s/).slice(1, -1) : [];
    });
  }

  async close() {
    await this.write("0");
    this.#discard();
  }

  private async write(str: string) {
    if (!this.#server) return;

    await this.#server.writer.write(encode(str, this.requestEncoding));
  }
}

function encode(str: string, encode: Encoding): Uint8Array {
  const utf8Encoder = new TextEncoder();
  const utf8Bytes = utf8Encoder.encode(str);
  const eucBytesArray = encoding.convert(utf8Bytes, Encode[encode], "UTF8");
  const eucBytes = Uint8Array.from(eucBytesArray);
  return eucBytes;
}
