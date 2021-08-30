import { romToHira } from "./kana/rom_hira.ts";
import type { KanaTable } from "./kana/type.ts";
import { Cell } from "./util.ts";

const tables: Cell<Record<string, KanaTable>> = new Cell(() => ({
  "romToHira": romToHira,
}));

let currentTable = "romToHira";

export function setCurrentKanaTable(name: string) {
  currentTable = name;
}

export function getKanaTable(name = currentTable): KanaTable {
  const table = tables.get()[name];
  if (!table) {
    throw new Error(`undefined table: ${name}`);
  }
  return table;
}
