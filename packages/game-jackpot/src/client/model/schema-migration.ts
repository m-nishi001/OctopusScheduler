import type { JackpotRecord, Prize, ScreenSettingRecord } from "../../server/jackpot-api-contract";
import type { JackpotMemberExtra } from "./member/jackpot-member-extra";
import { DEFAULT_WEIGHT } from "./draw/weighted-selector";
import { DEFAULT_PRIZE_RANK } from "./prize/prize-rank";

/**
 * 景品のレコード `jackpot-config.json` の形式の版。
 * 1: メンバーの「ランク」を廃止し、当選しやすさを1〜10(既定5)に、景品の重みを景品ランク1〜5(既定3)にした。
 * 2: デモ・結果画面の使っていない項目(demoSe2・resultSe1・resultSe2)を消し、demoSe1 を demoDrawSe に改名した。
 */
export const JACKPOT_SCHEMA_VERSION = 2;

/** メンバーの拡張設定の形式の版。1: 当選しやすさを1〜10(既定5)にした。 */
export const MEMBER_EXTRA_SCHEMA_VERSION = 1;

/** メンバーの拡張設定の保存形式。版つきのオブジェクトにして、一覧は `extras` に持つ。 */
export interface MemberExtraData {
  schemaVersion: number;
  extras: JackpotMemberExtra[];
}

const isOlderThan = (version: unknown, current: number): boolean => typeof version !== "number" || version < current;

/** 古い景品の `weight` を捨てて、景品ランクを既定値(3)にする。 */
const resetPrize = (p: Prize & { weight?: unknown }): Prize => {
  const { weight: _weight, ...rest } = p;
  return { ...rest, rank: DEFAULT_PRIZE_RANK };
};

/** 版2: 画面設定の項目の整理。デモ画面は demoSe1 を demoDrawSe に改名して demoSe2 を捨て、結果画面は resultSe1・resultSe2 を捨てる。 */
const RETIRED_SCREEN_KEYS: Readonly<Record<string, { drop: readonly string[]; rename?: Readonly<Record<string, string>> }>> = {
  "demo-screen-settings": { drop: ["demoSe2"], rename: { demoSe1: "demoDrawSe" } },
  "result-screen-settings": { drop: ["resultSe1", "resultSe2"] },
};

function tidyScreen(s: ScreenSettingRecord): ScreenSettingRecord {
  const rule = RETIRED_SCREEN_KEYS[s.settingName];
  if (!rule) return s;
  let value: unknown;
  try {
    value = JSON.parse(s.settingValue);
  } catch {
    return s;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return s;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (rule.drop.includes(key)) continue;
    out[rule.rename?.[key] ?? key] = v;
  }
  return { ...s, settingValue: JSON.stringify(out) };
}

/**
 * 景品のレコードを現在の版にする。版ごとの段階を、足りない分だけ順に行う。
 * - 版1に満たない(版が無いものを含む): 景品ランクをすべて既定値(3)に戻し、古い `weight` を捨てる。
 * - 版2に満たない: 画面設定の使っていない項目を消し、`demoSe1` を `demoDrawSe` に改名する(景品ランクは触らない)。
 * 現在の版ならそのまま返す(何度呼んでも同じ結果)。`changed` が true のときだけ、呼び出し側が保存し直す。
 */
export function migrateJackpotRecord(record: JackpotRecord): { record: JackpotRecord; changed: boolean } {
  if (!isOlderThan(record.schemaVersion, JACKPOT_SCHEMA_VERSION)) return { record, changed: false };
  const prizes = isOlderThan(record.schemaVersion, 1) ? record.prizes.map(resetPrize) : record.prizes;
  const screens = record.screens.map(tidyScreen);
  return { record: { ...record, schemaVersion: JACKPOT_SCHEMA_VERSION, prizes, screens }, changed: true };
}

/**
 * 保存されているメンバーの拡張設定(以前は一覧の配列そのもの)を、現在の版の形にする。
 * 古い版なら、当選しやすさをすべて既定値(5)に戻し、廃止した `rank` を捨てる。何度呼んでも同じ結果。
 */
export function migrateMemberExtraData(stored: unknown): { data: MemberExtraData; changed: boolean } {
  const object = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Partial<MemberExtraData>) : null;
  const list: unknown[] = Array.isArray(stored) ? stored : Array.isArray(object?.extras) ? object.extras : [];
  const rows = list.filter((e): e is JackpotMemberExtra => !!e && typeof (e as JackpotMemberExtra).memberId === "string");
  if (object && !isOlderThan(object.schemaVersion, MEMBER_EXTRA_SCHEMA_VERSION)) {
    return { data: { schemaVersion: object.schemaVersion as number, extras: rows }, changed: false };
  }
  return {
    data: { schemaVersion: MEMBER_EXTRA_SCHEMA_VERSION, extras: rows.map((e) => ({ memberId: e.memberId, weight: DEFAULT_WEIGHT })) },
    changed: stored != null,
  };
}
