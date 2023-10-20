import { CompletionMetadata } from "../@ddc-sources/skkeleton.ts";
import { BaseFilter, FilterArguments } from "../skkeleton/deps/ddc/filter.ts";
import { Item } from "../skkeleton/deps/ddc/types.ts";

type Params = Record<string, never>;

export class Filter extends BaseFilter<Params> {
  async filter(
    args: FilterArguments<Params>,
  ): Promise<Item<CompletionMetadata>[]> {
    const items = args.items as Item<CompletionMetadata>[];
    const prefix =
      (await args.denops.dispatch("skkeleton", "getPrefix")) as string;
    return Promise.resolve(items
      .filter((item) =>
        item
          .user_data!
          .kana
          .startsWith(prefix)
      ));
  }

  params() {
    return {};
  }
}
