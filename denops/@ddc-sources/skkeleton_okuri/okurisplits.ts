export function okuriSplits(text: string): [string, string][] {
  if (text === "") {
    return [];
  }
  const chars = [...text];
  const result: [string, string][] = [];
  for (let i = chars.length - 1; i >= 1; i--) {
    result.push([chars.slice(0, i).join(""), chars.slice(i).join("")]);
  }
  return result;
}
