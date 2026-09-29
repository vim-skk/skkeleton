import { AffixType } from "./state.ts";

export function modifyCandidate(candidate: string, affix?: AffixType) {
  const separator = candidate.indexOf(";");
  const candidateStrip = separator === -1
    ? candidate
    : candidate.slice(0, separator);

  if (affix === "prefix") {
    return candidateStrip.replace(/>$/, "");
  } else if (affix === "suffix") {
    return candidateStrip.replace(/^>/, "");
  } else {
    return candidateStrip;
  }
}
