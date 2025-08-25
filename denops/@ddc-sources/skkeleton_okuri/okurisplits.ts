export function okuriSplits(text: string): [string, string][] {
  if (text === "") {
    return [];
  }
  const a = [...text];
  const r = Array.from(Array(a.length - 1), (_, i) => a.length - 1 - i);
  return r.map((i) => [a.slice(0, i).join(""), a.slice(i).join("")]);
}
