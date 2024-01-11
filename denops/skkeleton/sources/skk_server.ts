import { encoding } from "../deps/encoding_japanese.ts";
import { Encode } from "../types.ts";
import { getKanaTable } from "../kana.ts";
import { TextLineStream } from "../deps/std/streams.ts";
import { Dictionary, HenkanType } from "../dictionary.ts";
import type { CompletionData, Encoding, SkkServerOptions } from "../types.ts";

type Server = {
  conn: Deno.Conn;
  readCallback: (result: string) => void;
  writer: WritableStreamDefaultWriter<Uint8Array>;
};

export class SkkServer implements Dictionary {
  #server: Server | undefined;
  responseEncoding: Encoding;
  requestEncoding: Encoding;
  connectOptions: Deno.ConnectOptions;

  constructor(opts: SkkServerOptions) {
    this.requestEncoding = opts.requestEnc;
    this.responseEncoding = opts.responseEnc;
    this.connectOptions = {
      hostname: opts.hostname,
      port: opts.port,
    };
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
      ).finally(() => {
        this.#server = undefined;
      });
    const writer = conn.writable.getWriter();
    this.#server = {
      conn,
      readCallback: () => {},
      writer,
    };
  }

  async getHenkanResult(_type: HenkanType, word: string): Promise<string[]> {
    await this.connect();

    if (this.#server == null) return [];
    const { promise, resolve } = Promise.withResolvers<string>();
    this.#server.readCallback = resolve;

    await this.write(`1${word} `);
    const response = await promise;
    const result = response.at(0) === "1"
      ? response.split("/").slice(1, -1)
      : [];

    return result;
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

  private async getMidashis(prefix: string): Promise<string[]> {
    // Get midashis from prefix
    await this.connect();

    if (!this.#server) return [];

    if (this.#server == null) return [];
    const { promise, resolve } = Promise.withResolvers<string>();
    this.#server.readCallback = resolve;

    await this.write(`4${prefix} `);
    const response = await promise;
    const result = response.at(0) === "1"
      ? response.split(/\/|\s/).slice(1, -1)
      : [];

    return result;
  }

  async close() {
    await this.write("0");
    this.#server?.conn.close();
    this.#server = undefined;
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
