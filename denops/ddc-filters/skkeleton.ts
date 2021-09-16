import { BaseFilter, FilterArguments } from "../skkeleton/deps/ddc/filter.ts";
import { Candidate } from "../skkeleton/deps/ddc/types.ts";

export class Filter extends BaseFilter {
  async filter(args: FilterArguments): Promise<Candidate[]> {
    const prefix =
      (await args.denops.dispatch("skkeleton", "getPrefix")) as string;
    return Promise.resolve(args.candidates.filter(
      (candidate) => (candidate.user_data as string).startsWith(prefix),
    ));
  }
}
