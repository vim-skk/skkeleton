import type { KanaTable } from "./kana/type.ts";
import { romToHira } from "./kana/rom_hira.ts";

const tables: Record<string, KanaTable> = {
  "romToHira": romToHira,
};

let currentTable = "romToHira";

export function setCurrentKanaTable(name: string) {
  currentTable = name;
}

export function getKanaTable(name = currentTable): KanaTable {
  const table = tables[name];
  if (!table) {
    throw new Error(`undefined table: ${name}`);
  }
  return table;
}
