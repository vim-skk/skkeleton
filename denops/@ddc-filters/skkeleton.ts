import { CompletionMetadata } from "../@ddc-sources/skkeleton.ts";
import { BaseFilter, FilterArguments } from "../skkeleton/deps/ddc/filter.ts";
import { Candidate } from "../skkeleton/deps/ddc/types.ts";

export class Filter extends BaseFilter<Record<string, never>> {
  async filter(
    args: FilterArguments<Record<string, never>>,
  ): Promise<Candidate[]> {
    const candidates = args.candidates as Candidate<CompletionMetadata>[];
    const prefix =
      (await args.denops.dispatch("skkeleton", "getPrefix")) as string;
    return Promise.resolve(candidates
      .filter((candidate) =>
        candidate
          .user_data!
          .kana
          .startsWith(prefix)
      ));
  }

  params() {
    return {};
  }
}
