import type { CompletionData, RankData } from "./types.ts";
import { getOkuriStr, okuriSplits } from "./okuri.ts";

type HenkanType = "okurinasi" | "okuriari";

export type CompleteItem = {
  word: string;
  abbr: string;
  info: string;
  equal: 1;
  // NOTE: 送り仮名の分割違いや注釈違いで表記が重なる候補があるため、
  // Vimに重複候補を捨てさせない
  dup: 1;
  // NOTE: 注釈のみのエントリは表記が空になり、既定では候補から落とされる
  empty: 1;
  user_data: string;
};

type CompleteItemMetadata = {
  tag: "skkeleton";
  midasi: string;
  word: string;
  type: HenkanType;
};

type RankedCompleteItem = CompleteItem & {
  rank: number;
};

// 最初の`;`以降が注釈
function splitAnnotation(word: string): [string, string] {
  const index = word.indexOf(";");
  if (index < 0) {
    return [word, ""];
  }
  return [word.slice(0, index), word.slice(index + 1)];
}

function userData(metadata: CompleteItemMetadata): string {
  return JSON.stringify(metadata);
}

export function buildOkurinasiCompleteItems(
  candidates: CompletionData,
  rankData: RankData,
): CompleteItem[] {
  const ranks = new Map(rankData);
  const sortedCandidates = [...candidates].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  let globalRank = -1;

  const items: RankedCompleteItem[] = sortedCandidates.flatMap((
    [kana, words],
  ) =>
    words.map((word): RankedCompleteItem => {
      const [candidate, note] = splitAnnotation(word);
      return {
        word: candidate,
        abbr: candidate,
        info: note,
        equal: 1,
        dup: 1,
        empty: 1,
        user_data: userData({
          tag: "skkeleton",
          midasi: kana,
          word,
          type: "okurinasi",
        }),
        rank: ranks.get(word) ?? globalRank--,
      };
    })
  );

  return items
    .sort((a, b) => b.rank - a.rank)
    .map(({ rank: _, ...item }) => item);
}

export async function buildOkuriariCompleteItems(
  kana: string,
  getCandidates: (midasi: string) => Promise<string[] | undefined>,
): Promise<CompleteItem[]> {
  const chunks = okuriSplits(kana);

  const cache = new Map<string, Promise<string[] | undefined>>();

  function getCachedCandidates(
    midasi: string,
  ): Promise<string[] | undefined> {
    let result = cache.get(midasi);
    if (!result) {
      result = getCandidates(midasi);
      cache.set(midasi, result);
    }
    return result;
  }

  const results = await Promise.all(
    chunks.map(async ([word, okuri]) => {
      const midasi = getOkuriStr(word, okuri);
      const candidates = await getCachedCandidates(midasi);
      return {
        midasi,
        okuri,
        candidates,
      };
    }),
  );

  return results.flatMap(({ midasi, okuri, candidates }) => {
    if (candidates == null) {
      return [];
    }

    return candidates.map((candidate) => {
      const [stripped, note] = splitAnnotation(candidate);
      return {
        word: stripped + okuri,
        abbr: stripped + okuri,
        info: note,
        equal: 1,
        dup: 1,
        empty: 1,
        user_data: userData({
          tag: "skkeleton",
          midasi,
          word: candidate,
          type: "okuriari",
        }),
      };
    });
  });
}

export async function buildCompleteItems(
  candidates: CompletionData,
  rankData: RankData,
  kana: string,
  getOkuriariCandidates: (midasi: string) => Promise<string[] | undefined>,
): Promise<CompleteItem[]> {
  return [
    ...buildOkurinasiCompleteItems(candidates, rankData),
    ...await buildOkuriariCompleteItems(kana, getOkuriariCandidates),
  ];
}
