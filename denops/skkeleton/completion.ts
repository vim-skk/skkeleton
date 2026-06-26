import type { CompletionData, RankData } from "./types.ts";
import { getOkuriStr, okuriSplits } from "./okuri.ts";

type HenkanType = "okurinasi" | "okuriari";

export type CompleteItem = {
  word: string;
  abbr: string;
  info: string;
  equal: 1;
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

function stripAnnotation(word: string): string {
  return word.replace(/;.*$/, "");
}

function annotation(word: string): string {
  return word.indexOf(";") > 1 ? word.replace(/.*;/, "") : "";
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
    words.map((word) => ({
      word: stripAnnotation(word),
      abbr: stripAnnotation(word),
      info: annotation(word),
      equal: 1,
      user_data: userData({
        tag: "skkeleton",
        midasi: kana,
        word,
        type: "okurinasi",
      }),
      rank: ranks.get(word) ?? globalRank--,
    }))
  );

  return items
    .sort((a, b) => b.rank - a.rank)
    .map(({ rank: _, ...item }) => item);
}

export async function buildOkuriariCompleteItems(
  kana: string,
  getCandidates: (midasi: string) => Promise<string[] | undefined>,
): Promise<CompleteItem[]> {
  const items: CompleteItem[] = [];
  for (const [word, okuri] of okuriSplits(kana)) {
    const midasi = getOkuriStr(word, okuri);
    const candidates = await getCandidates(midasi);
    if (candidates == null) {
      continue;
    }
    for (const candidate of candidates) {
      items.push({
        word: stripAnnotation(candidate) + okuri,
        abbr: stripAnnotation(candidate) + okuri,
        info: annotation(candidate),
        equal: 1,
        user_data: userData({
          tag: "skkeleton",
          midasi,
          word: candidate,
          type: "okuriari",
        }),
      });
    }
  }
  return items;
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
