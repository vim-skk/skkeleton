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
    const candidates: Item<CompletionMetadata>[] = [];
    for (const [word, okuri] of chunks) {
      const midasi = getOkuriStr(word, okuri);
      const cands = await args.denops.dispatch(
        "skkeleton",
        "getCandidates",
        midasi,
        "okuriari",
      ) as string[] | undefined;
      if (cands == null) {
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
