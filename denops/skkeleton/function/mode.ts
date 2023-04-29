import { config } from "../config.ts";
import { Context } from "../context.ts";
import { currentKanaTable, getKanaTable } from "../kana.ts";
import { hiraToHanKata } from "../kana/hira_hankata.ts";
import { hiraToKata } from "../kana/hira_kata.ts";
import { modeChange } from "../mode.ts";
import { initializeState } from "../state.ts";
import { currentLibrary } from "../store.ts";
import { kakutei } from "./common.ts";
import { henkanFirst } from "./henkan.ts";
import { henkanPoint, kakuteiFeed } from "./input.ts";

export async function abbrev(context: Context) {
  if (context.state.type !== "input" || context.state.mode !== "direct") {
    return;
  }
  henkanPoint(context);
  const s = context.state;
  s.table = s.table.filter(([, func]) => func === henkanFirst);
  s.directInput = true;
  await modeChange(context, "abbrev");
}

export async function hirakana(context: Context) {
  if (context.state.type !== "input") {
    return;
  }
  const state = context.state;
  if (state.mode !== "direct") {
    await kakutei(context);
  }
  currentKanaTable.set("rom");
  if (state.type === "input") state.converter = void 0;
  initializeState(state, ["converter"]);
  await modeChange(context, "hira");
}

export async function katakana(context: Context) {
  if (context.state.type !== "input") {
    return;
  }
  const state = context.state;
  if (state.mode === "direct") {
    if (state.converter) {
      state.converter = void 0;
      await modeChange(context, "hira");
    } else {
      state.converter = hiraToKata;
      await modeChange(context, "kata");
    }
    return;
  }
  kakuteiFeed(context);
  const kana = state.henkanFeed + state.okuriFeed;
  let result = kana;
  if (!state.converter) {
    result = hiraToKata(result);
    if (config.registerConvertResult) {
      const lib = await currentLibrary.get();
      await lib.registerCandidate("okurinasi", kana, result);
      context.lastCandidate = {
        type: "okurinasi",
        word: kana,
        candidate: result,
      };
    }
  }
  context.kakuteiWithUndoPoint(result);
  initializeState(state, ["converter"]);
}

export async function hankatakana(context: Context) {
  if (context.state.type !== "input") {
    return;
  }
  const state = context.state;
  if (state.mode === "direct") {
    if (state.converter === hiraToHanKata) {
      state.converter = void 0;
      await modeChange(context, "hira");
    } else {
      if (currentKanaTable.get() === "zen") {
        currentKanaTable.set(config.kanaTable);
        state.table = getKanaTable();
      }
      state.converter = hiraToHanKata;
      await modeChange(context, "hankata");
    }
    return;
  }
  kakuteiFeed(context);
  const kana = state.henkanFeed + state.okuriFeed;
  let result = kana;
  if (state.converter !== hiraToHanKata) {
    result = hiraToHanKata(result);
    if (config.registerConvertResult) {
      const lib = await currentLibrary.get();
      await lib.registerCandidate("okurinasi", kana, result);
      context.lastCandidate = {
        type: "okurinasi",
        word: kana,
        candidate: result,
      };
    }
  }
  context.kakuteiWithUndoPoint(result);
  initializeState(state, ["converter"]);
}

export async function zenkaku(context: Context) {
  if (context.state.type !== "input") {
    return;
  }
  const state = context.state;
  if (state.mode !== "direct") {
    await kakutei(context);
  }
  currentKanaTable.set("zen");
  state.table = getKanaTable();
  await modeChange(context, "zenkaku");
}
