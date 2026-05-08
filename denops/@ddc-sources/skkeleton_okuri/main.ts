import { getOkuriStr } from "../../skkeleton/okuri.ts";
import { okuriSplits } from "./okurisplits.ts";

import {
  BaseSource,
  type GatherArguments,
  type GetCompletePositionArguments,
  type OnCompleteDoneArguments,
} from "@shougo/ddc-vim/source";
import { type Item } from "@shougo/ddc-vim/types";

type Never = Record<PropertyKey, never>;

type CompletionMetadata = {
  skkeleton: {
    midasi: string;
    word: string;
  };
};

export class Source extends BaseSource<Never> {
  override async getCompletePosition(
    args: GetCompletePositionArguments<Never>,
  ): Promise<number> {
    const preEditLength = await args.denops.dispatch(
      "skkeleton",
      "getPreEditLength",
    ).catch(() => 0) as number;
    if (preEditLength != 0) {
      return args.context.input.length - preEditLength;
    }
    return -1;
  }

  override async gather(
    args: GatherArguments<Never>,
  ): Promise<Item<CompletionMetadata>[]> {
    const kana = String(
      await args.denops.dispatch(
        "skkeleton",
        "getPrefix",
      ),
    );

    const chunks = okuriSplits(kana ?? "");
    if (chunks.length === 0) {
      return [];
    }
    const midashis = chunks.map(([word, okuri]) => getOkuriStr(word, okuri));
    const results = await args.denops.dispatch(
      "skkeleton",
      "getCandidatesBatch",
      midashis,
      "okuriari",
    ) as Record<string, string[]>;

    const candidates: Item<CompletionMetadata>[] = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const [, okuri] = chunks[idx];
      const midasi = midashis[idx];
      const cands = results[midasi];
      if (!cands) {
        continue;
      }
      for (const cand of cands) {
        const candStrip = cand.replace(/;.*$/, "");
        candidates.push({
          word: candStrip + okuri,
          user_data: {
            skkeleton: {
              midasi,
              word: cand,
            },
          },
        });
      }
    }
    return candidates;
  }

  override async onCompleteDone(
    args: OnCompleteDoneArguments<Never, CompletionMetadata>,
  ) {
    await args.denops.dispatch(
      "skkeleton",
      "completeCallback",
      args.userData.skkeleton.midasi,
      args.userData.skkeleton.word,
      "okuriari",
    );
  }

  override params(): Never {
    return {};
  }
}
