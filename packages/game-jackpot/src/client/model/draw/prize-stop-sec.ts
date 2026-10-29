/**
 * 景品抽選で、停止ボタンを押してから最後の景品が止まるまでの長さ(秒)。管理画面の「本抽選画面設定」で決める。
 * スロット・ルーレットで共通。確変の演出の長さは変わらない。
 */
export const DEFAULT_PRIZE_STOP_SEC = 4;
export const MIN_PRIZE_STOP_SEC = 2;
export const MAX_PRIZE_STOP_SEC = 15;

/** 範囲(2〜15秒)に収め、0.5秒刻みに丸める。数でない値は既定。 */
export function clampPrizeStopSec(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_PRIZE_STOP_SEC;
  const rounded = Math.round(n * 2) / 2;
  return Math.min(MAX_PRIZE_STOP_SEC, Math.max(MIN_PRIZE_STOP_SEC, rounded));
}

/** 保存されている画面設定（`main-screen-settings`）から取り出す。無い・形が違うときは既定(4秒)。 */
export function parsePrizeStopSec(settings: unknown): number {
  if (typeof settings !== "object" || settings === null) return DEFAULT_PRIZE_STOP_SEC;
  return clampPrizeStopSec((settings as { prizeStopSec?: unknown }).prizeStopSec);
}
