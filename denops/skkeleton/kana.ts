import { romToHira } from "./kana/rom_hira.ts";
import type { KanaTable } from "./kana/type.ts";
import { Cell } from "./util.ts";

const tables: Cell<Record<string, KanaTable>> = new Cell(() => ({
  "romToHira": romToHira,
}));

export const currentKanaTable = new Cell(() => "romToHira");

export function getKanaTable(name = currentKanaTable.get()): KanaTable {
  const table = tables.get()[name];
  if (!table) {
    throw new Error(`undefined table: ${name}`);
  }
  return table;
}
