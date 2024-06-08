import { AffixType } from "./state.ts";

export function modifyCandidate(candidate: string, affix?: AffixType) {
  const candidateStrip = candidate?.replace(/;.*/, "");

  if (affix === "prefix") {
    return candidateStrip?.replace(/[>＞]$/, "");
  } else if (affix === "suffix") {
    return candidateStrip?.replace(/^[>＞]/, "");
  } else {
    return candidateStrip;
  }
}
