import { config } from "../config.ts";
import { Dictionary, HenkanType } from "../jisyo.ts";
import type { CompletionData } from "../types.ts";

export class GoogleJapaneseInput implements Dictionary {
  async connect() {}
  async getHenkanResult(_type: HenkanType, word: string): Promise<string[]> {
    // It should not work for "okuriari".
    return _type === "okuriari" ? [] : await this.getMidashis(word);
  }
  getCompletionResult(_prefix: string, _feed: string): Promise<CompletionData> {
    // Note: It does not support completions
    return Promise.resolve([]);
  }
  private async getMidashis(prefix: string): Promise<string[]> {
    // Get midashis from prefix
    const params = new URLSearchParams({
      langpair: "ja-Hira|ja",
      text: `${prefix},`,
    });

    const timeout = (ms: number) => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Timeout error"));
        }, ms);
      });
    };

    const fetchWithTimeout = (
      url: string,
      options: RequestInit,
      timeoutMs: number,
    ) => {
      return Promise.race([
        fetch(url, options),
        timeout(timeoutMs),
      ]) as Promise<Response>;
    };

    try {
      // Note: Google API access may be slow.
      const resp = await fetchWithTimeout(
        `http://www.google.com/transliterate?${params.toString()}`,
        {
          method: "GET",
        },
        500,
      );
      const respJson = await resp.json();
      return respJson[0][1];
    } catch (e) {
      if (config.debug) {
        console.log(e);
      }
    }
    return [];
  }
  close() {}
}
