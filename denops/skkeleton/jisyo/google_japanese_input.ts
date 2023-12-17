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
    try {
      const resp = await fetch(
        `http://www.google.com/transliterate?${params.toString()}`,
        {
          method: "GET",
        },
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
