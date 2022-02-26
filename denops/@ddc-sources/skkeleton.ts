import {
  BaseSource,
  GatherArguments,
  GetCompletePositionArguments,
  OnCompleteDoneArguments,
} from "../skkeleton/deps/ddc/source.ts";
import { DdcGatherItems } from "../skkeleton/deps/ddc/types.ts";
import type { CompletionData, RankData } from "../skkeleton/types.ts";

export type CompletionMetadata = {
  kana: string;
  word: string;
  rank: number;
};

type Params = Record<never, never>;

export class Source extends BaseSource<Params> {
  async getCompletePosition(
    args: GetCompletePositionArguments<Record<string, never>>,
  ): Promise<number> {
    const inputLength = args.context.input.length;
    const preEditLength =
      (await args.denops.dispatch("skkeleton", "getPreEditLength")) as number;
    return inputLength - preEditLength;
  }

  async gather(
    args: GatherArguments<Params>,
  ): Promise<DdcGatherItems> {
    const candidates = (await args.denops.dispatch(
      "skkeleton",
      "getCandidates",
    )) as CompletionData;
    const ranks = new Map(
      (await args.denops
        .dispatch("skkeleton", "getRanks")) as RankData,
    );
    candidates.sort((a, b) => a[0].localeCompare(b[0]));

    // グローバル辞書由来の候補はユーザー辞書の末尾より配置する
    // 辞書順に並べるため先頭から順に負の方向にランクを振っていく
    let globalRank = -1;
    const ddcCandidates = candidates.flatMap((e) => {
      return e[1].map((word) => ({
        word: word.replace(/;.*$/, ""),
        abbr: word,
        user_data: {
          kana: e[0],
          word,
          rank: ranks.get(word) ?? globalRank--,
        },
      }));
    });
    ddcCandidates.sort((a, b) => b.user_data.rank - a.user_data.rank);
    return {
      items: ddcCandidates,
      isIncomplete: false,
    };
  }

  params() {
    return {};
  }

  async onCompleteDone(
    args: OnCompleteDoneArguments<Params, CompletionMetadata>,
  ) {
    const meta = args.userData;
    await args.denops.dispatch(
      "skkeleton",
      "registerCandidate",
      meta.kana,
      meta.word,
    );
  }
}
