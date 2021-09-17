import { isObject } from "../skkeleton/deps.ts";

export type CompletionMetadata = {
  tag: "skkeleton";
  kana: string;
};

export function asCompletionMetadata(x: unknown): CompletionMetadata | null {
  if (isObject(x) && x.tag === "skkeleton") {
    return x as CompletionMetadata;
  }
  return null;
}
