import { CompletionMetadata } from "../@ddc-sources/skkeleton.ts";
import { BaseFilter, FilterArguments } from "../skkeleton/deps/ddc/filter.ts";
import { Candidate } from "../skkeleton/deps/ddc/types.ts";

export class Filter extends BaseFilter<Record<string, never>> {
  async filter(
    args: FilterArguments<Record<string, never>>,
  ): Promise<Candidate[]> {
    const prefix =
      (await args.denops.dispatch("skkeleton", "getPrefix")) as string;
    return Promise.resolve(args.candidates.filter(
      (candidate) => {
        const meta = candidate.user_data as unknown as CompletionMetadata;
        return meta && meta.kana.startsWith(prefix);
      },
    ));
  }

  params() {
    return {};
  }
}
