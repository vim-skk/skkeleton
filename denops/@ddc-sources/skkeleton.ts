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
        info: word.indexOf(";") > 1 ? word.replace(/.*;/, "") : "",
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
    const bufferInput = String(
      await args.denops.eval("getline('.')[:col('.')-2]"),
    );
    const preEdit = String(
      await args.denops.dispatch("skkeleton", "getPreEdit"),
    );
    // console.log([preEdit, args.userData.kana, bufferInput])
    // 候補を選んだ状態でキャンセルした際も呼ばれるので弾く
    // この際、preEditが空ではなくバッファの一部とpreEditが一致している
    if (preEdit !== "" && bufferInput.endsWith(preEdit)) {
      return;
    }
    const meta = args.userData;
    await args.denops.dispatch(
      "skkeleton",
      "completeCallback",
      meta.kana,
      meta.word,
    );
  }
}
