import { ensureObject, isString } from "./deps.ts";
import { distinctBy } from "./deps/std/collections.ts";
import { functions } from "./function.ts";
import { romToHira } from "./kana/rom_hira.ts";
import type { KanaResult, KanaTable } from "./kana/type.ts";
import { Cell } from "./util.ts";

const tables: Cell<Record<string, KanaTable>> = new Cell(() => ({
  "rom": romToHira,
}));

export const currentKanaTable = new Cell(() => "rom");

export function getKanaTable(name = currentKanaTable.get()): KanaTable {
  const table = tables.get()[name];
  if (!table) {
    throw new Error(`undefined table: ${name}`);
  }
  return table;
}

function asKanaResult(result: unknown): KanaResult {
  if (typeof result === "string") {
    const fn = functions.get()[result];
    if (!fn) {
      throw Error(`function not found: ${result}`);
    }
    return fn;
  } else if (
    Array.isArray(result) &&
    result.length === 2 &&
    result.every(isString)
  ) {
    return result as KanaResult;
  }
  throw Error(`Illegal result: ${result}`);
}

export function registerKanaTable(name: string, rawTable: unknown) {
  ensureObject(rawTable);
  const table: KanaTable = Object.entries(rawTable).map((
    e,
  ) => [e[0], asKanaResult(e[1])]);
  const t = tables.get();
  const newTable = distinctBy([...table, ...t[name] ?? []], (it) => it[0])
    .sort();
  t[name] = newTable;
}
