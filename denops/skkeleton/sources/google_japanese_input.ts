import { config } from "../config.ts";
import {
  Dictionary as BaseDictionary,
  HenkanType,
  Source as BaseSource,
} from "../dictionary.ts";
import type { CompletionData } from "../types.ts";

import { deadline } from "@std/async/deadline";

export class Source implements BaseSource {
  getDictionaries(): Promise<BaseDictionary[]> {
    return Promise.resolve([new Dictionary()]);
  }
}

export class Dictionary implements BaseDictionary {
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
      // Note: Google API access may be slow.
      const resp = await deadline(
        fetch(
          `http://www.google.com/transliterate?${params.toString()}`,
          {
            method: "GET",
          },
        ),
        500,
      );
      const respJson = await resp.json();
      return respJson[0][1];
    } catch (e) {
      if (e instanceof DOMException) {
        // Ignore timeout error
      } else if (config.debug) {
        console.log(e);
      }
    }
    return [];
  }
  close() {}
}
