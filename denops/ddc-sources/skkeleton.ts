import {
  BaseSource,
  GatherCandidatesArguments,
  GetCompletePositionArguments,
} from "../skkeleton/deps/ddc/source.ts";
import { Candidate } from "../skkeleton/deps/ddc/types.ts";
import { CompletionMetadata } from "../skkeleton/types.ts";

export class Source extends BaseSource {
  async getCompletePosition(
    args: GetCompletePositionArguments,
  ): Promise<number> {
    const inputLength = args.context.input.length;
    const preEditLength =
      (await args.denops.dispatch("skkeleton", "getPreEditLength")) as number;
    return inputLength - preEditLength;
  }

  async gatherCandidates(
    args: GatherCandidatesArguments,
  ): Promise<Candidate[]> {
    const candidates =
      (await args.denops.dispatch("skkeleton", "getCandidates")) as [
        string,
        string[],
      ][];
    const ddcCandidates = candidates.flatMap((e) => {
      const metaData: CompletionMetadata = {
        tag: "skkeleton",
        kana: e[0],
      };
      return e[1].map((word) => ({
        word: word.replace(/;.*$/, ""),
        abbr: word,
        user_data: metaData,
      }));
    });
    return Promise.resolve(ddcCandidates);
  }
}
