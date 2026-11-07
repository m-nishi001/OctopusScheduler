import type { JackpotRecord, Prize } from "../../server/jackpot-api-contract";
import type { JackpotMemberExtra } from "./member/jackpot-member-extra";
import { DEFAULT_WEIGHT } from "./draw/weighted-selector";
import { DEFAULT_PRIZE_RANK } from "./prize/prize-rank";

/**
 * 保存データの形式の版(景品のレコード `jackpot-config.json` とメンバーの拡張設定で共通)。
 * 1: メンバーの「ランク」を廃止し、当選しやすさを1〜10(既定5)に、景品の重みを景品ランク1〜5(既定3)にした。
 */
export const JACKPOT_SCHEMA_VERSION = 1;

/** メンバーの拡張設定の保存形式。版つきのオブジェクトにして、一覧は `extras` に持つ。 */
export interface MemberExtraData {
  schemaVersion: number;
  extras: JackpotMemberExtra[];
}

const isOld = (version: unknown): boolean => typeof version !== "number" || version < JACKPOT_SCHEMA_VERSION;

/** 古い景品の `weight` を捨てて、景品ランクを既定値(3)にする。 */
const resetPrize = (p: Prize & { weight?: unknown }): Prize => {
  const { weight: _weight, ...rest } = p;
  return { ...rest, rank: DEFAULT_PRIZE_RANK };
};

/**
 * 景品のレコードを現在の版にする。古い版(版が無いものを含む)なら、景品ランクをすべて既定値(3)に戻し、古い `weight` を捨てる。
 * 現在の版ならそのまま返す(何度呼んでも同じ結果)。`changed` が true のときだけ、呼び出し側が保存し直す。
 */
export function migrateJackpotRecord(record: JackpotRecord): { record: JackpotRecord; changed: boolean } {
  if (!isOld(record.schemaVersion)) return { record, changed: false };
  return {
    record: { ...record, schemaVersion: JACKPOT_SCHEMA_VERSION, prizes: record.prizes.map(resetPrize) },
    changed: true,
  };
}

/**
 * 保存されているメンバーの拡張設定(以前は一覧の配列そのもの)を、現在の版の形にする。
 * 古い版なら、当選しやすさをすべて既定値(5)に戻し、廃止した `rank` を捨てる。何度呼んでも同じ結果。
 */
export function migrateMemberExtraData(stored: unknown): { data: MemberExtraData; changed: boolean } {
  const object = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Partial<MemberExtraData>) : null;
  const list: unknown[] = Array.isArray(stored) ? stored : Array.isArray(object?.extras) ? object.extras : [];
  const rows = list.filter((e): e is JackpotMemberExtra => !!e && typeof (e as JackpotMemberExtra).memberId === "string");
  if (object && !isOld(object.schemaVersion)) {
    return { data: { schemaVersion: object.schemaVersion as number, extras: rows }, changed: false };
  }
  return {
    data: { schemaVersion: JACKPOT_SCHEMA_VERSION, extras: rows.map((e) => ({ memberId: e.memberId, weight: DEFAULT_WEIGHT })) },
    changed: stored != null,
  };
}
