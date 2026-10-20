/**
 * 確変（予約した景品を当てる回）をどの回で起こすかの計画。管理画面の「本抽選画面設定」で決める。
 *
 *   - auto : おまかせ。景品の数の真ん中あたりで続けて2回（{@link PrizeReservationService.calculateKakuhenTimings}）。
 *   - fixed: 指定した回で起こす。「何回目の抽選か」を1始まりで並べる（例: 3,7）。空なら確変なし。
 *
 * 計画は、その本番の抽選を始めるときに一度だけ確定する（確変の回の状態として保存される）。
 * 抽選が始まったあとに設定を変えても、結果をリセットするまでは反映されない。
 */
export type KakuhenMode = "auto" | "fixed";

export interface KakuhenPlan {
  mode: KakuhenMode;
  /** mode が fixed のとき、確変にする回（1始まり）。 */
  fixedTimings: number[];
}

export const AUTO_KAKUHEN_PLAN: KakuhenPlan = { mode: "auto", fixedTimings: [] };

/**
 * 保存されている画面設定（`main-screen-settings`）から計画を取り出す。
 * 無い・形が違うときは、おまかせ（auto）にする。
 */
export function parseKakuhenPlan(settings: unknown): KakuhenPlan {
  if (typeof settings !== "object" || settings === null) return AUTO_KAKUHEN_PLAN;
  const { kakuhenMode, kakuhenFixedTimings } = settings as { kakuhenMode?: unknown; kakuhenFixedTimings?: unknown };
  if (kakuhenMode !== "fixed") return AUTO_KAKUHEN_PLAN;
  return { mode: "fixed", fixedTimings: Array.isArray(kakuhenFixedTimings) ? kakuhenFixedTimings.filter(isPositiveInteger) : [] };
}

/** 入力欄の文字（例: `3, 7`）を回の一覧にする。数字以外・1未満・重複は取り除き、小さい順に並べる。 */
export function parseTimingsText(text: string): number[] {
  const numbers = text
    .split(/[,、\s]+/)
    .map((part) => part.trim())
    .filter((part) => /^\d+$/.test(part))
    .map(Number)
    .filter(isPositiveInteger);
  return Array.from(new Set(numbers)).sort((a, b) => a - b);
}

/**
 * 景品が `totalPrizes` 件のとき、確変にできる回に絞る。1〜`totalPrizes` の整数で、重複なし・小さい順。
 * 確変は予約した景品を使うので、通常の抽選用に最低1件は残す（最大で `totalPrizes - 1` 回）。
 */
export function usableKakuhenTimings(timings: readonly number[], totalPrizes: number): number[] {
  const usable = Array.from(new Set(timings.filter((t) => isPositiveInteger(t) && t <= totalPrizes))).sort((a, b) => a - b);
  return usable.slice(0, Math.max(0, totalPrizes - 1));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}
