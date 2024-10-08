import { type CompletionMetadata } from "../@ddc-sources/skkeleton.ts";
import {
  BaseFilter,
  type FilterArguments,
} from "../skkeleton/deps/ddc/filter.ts";
import { type Item } from "../skkeleton/deps/ddc/types.ts";

type Params = Record<string, never>;

export class Filter extends BaseFilter<Params> {
  override async filter(
    args: FilterArguments<Params>,
  ): Promise<Item<CompletionMetadata>[]> {
    await args.denops.cmd("echomsg msg", {
      msg:
        "skkeleton ddc filter is deprecated. Because filtering by source itself.",
    });
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
