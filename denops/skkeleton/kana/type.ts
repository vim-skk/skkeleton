import type { Func } from "../function.ts";

export type KanaTable = [from: string, result: KanaResult][];

export type KanaResult = [to: string, feed: string] | Func;
