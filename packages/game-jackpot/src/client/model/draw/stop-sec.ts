/**
 * 停止ボタンを押してから止まるまでの長さ(秒)。管理画面の「本抽選画面設定」で、メンバー抽選と景品抽選を別々に決める。
 * 景品抽選はスロット・ルーレットで共通(確変の演出の長さは変わらない)。
 */
export const DEFAULT_MEMBER_STOP_SEC = 3.5;
export const DEFAULT_PRIZE_STOP_SEC = 4;
export const MIN_STOP_SEC = 2;
export const MAX_STOP_SEC = 15;

/** 範囲(2〜15秒)に収め、0.5秒刻みに丸める。数でない値は `fallback`。 */
export function clampStopSec(value: unknown, fallback: number): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  const rounded = Math.round(n * 2) / 2;
  return Math.min(MAX_STOP_SEC, Math.max(MIN_STOP_SEC, rounded));
}

/** メンバー抽選の停止秒数を範囲に収める。 */
export const clampMemberStopSec = (value: unknown): number => clampStopSec(value, DEFAULT_MEMBER_STOP_SEC);
/** 景品抽選の停止秒数を範囲に収める。 */
export const clampPrizeStopSec = (value: unknown): number => clampStopSec(value, DEFAULT_PRIZE_STOP_SEC);

/** 保存されている画面設定(`main-screen-settings`)からメンバー抽選の停止秒数を取り出す。無い・形が違うときは既定。 */
export function parseMemberStopSec(settings: unknown): number {
  if (typeof settings !== "object" || settings === null) return DEFAULT_MEMBER_STOP_SEC;
  return clampMemberStopSec((settings as { memberStopSec?: unknown }).memberStopSec);
}

/** 保存されている画面設定(`main-screen-settings`)から景品抽選の停止秒数を取り出す。無い・形が違うときは既定。 */
export function parsePrizeStopSec(settings: unknown): number {
  if (typeof settings !== "object" || settings === null) return DEFAULT_PRIZE_STOP_SEC;
  return clampPrizeStopSec((settings as { prizeStopSec?: unknown }).prizeStopSec);
}
