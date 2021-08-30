import { KeyHandler } from "../keymap.ts";

export type KanaTable = [from: string, result: KanaResult][];

export type KanaResult = [to: string, feed: string] | KeyHandler;
