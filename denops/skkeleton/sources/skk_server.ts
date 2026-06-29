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

// 1 回のリクエスト/レスポンスの往復にこの時間だけ猶予を与え、超えたら諦めて空で解決
// する。応答が 1 つ失われても、下の直列化したキューがデッドロックしないようにするため。
// skkserv の応答は通常ほぼ即座に返るが、ネットワーク上の skkserv が遅い辞書引きへ
// フォールバックする場合が現実的な最悪ケース。
const REQUEST_TIMEOUT_MS = 5000;

export class Dictionary implements BaseDictionary {
  #server: Server | undefined;
  // ソケットの往復を直列化する。この接続は多重化を一切しておらず、`readCallback` の
  // 置き場所が 1 つしかないため、2 つのリクエストが同時に処理中になると互いを上書きし、
  // レスポンスが誤ったリクエストに紐付いてしまう（補完の問い合わせが変換の候補を受け取る、
  // など）。すべての往復をこの promise に繋ぐことで、同時に送信中の往復を常に 1 つだけに
  // 保つ。
  #queue: Promise<unknown> = Promise.resolve();
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

  /** 先にキューへ入れた処理がすべて完了してから `task` を実行する。 */
  #enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.#queue.then(task, task);
    // task が成功しても失敗しても鎖を継続し、ここで結果を握り潰すことで、処理されなかった
    // 失敗がキューの末尾から漏れないようにする。
    this.#queue = run.then(() => {}, () => {});
    return run;
  }

  /**
   * 1 つのコマンドを送り、その（1 行の）レスポンスで解決する。共有の `readCallback` が
   * 競合しないよう、必ず #enqueue の内側からのみ呼ぶこと。接続の失敗やタイムアウト時は
   * "" で解決する。
   */
  async #request(command: string): Promise<string> {
    await this.connect();
    if (!this.#server) return "";

    const { promise, resolve } = Promise.withResolvers<string>();
    const timer = setTimeout(() => resolve(""), REQUEST_TIMEOUT_MS);
    this.#server.readCallback = (response: string) => {
      clearTimeout(timer);
      resolve(response);
    };

    await this.write(command);
    return await promise;
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
