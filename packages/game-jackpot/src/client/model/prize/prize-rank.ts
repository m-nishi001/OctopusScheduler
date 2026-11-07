/** 景品ランクの範囲と既定値。ランクが大きいほど豪華でレア(当選しにくい)。 */
export const MIN_PRIZE_RANK = 1;
export const MAX_PRIZE_RANK = 5;
export const DEFAULT_PRIZE_RANK = 3;

/** 景品ランクを 1〜5 の整数にそろえる。未設定・不正値は既定値、範囲外は端に寄せる。 */
export function resolvePrizeRank(rank: number | undefined | null): number {
  let r = rank ?? DEFAULT_PRIZE_RANK;
  if (Number.isNaN(r) || !isFinite(r)) r = DEFAULT_PRIZE_RANK;
  if (r < MIN_PRIZE_RANK) r = MIN_PRIZE_RANK;
  if (r > MAX_PRIZE_RANK) r = MAX_PRIZE_RANK;
  return Math.floor(r);
}

/**
 * 景品ランクから、景品抽選で使う内部の重みを求める(景品抽選・取り置きで共通)。
 * ランク5(豪華)は重み1で最も当選しにくく、ランク1は重み5で最も当選しやすい。
 */
export function prizeRankToWeight(rank: number | undefined | null): number {
  return MAX_PRIZE_RANK + 1 - resolvePrizeRank(rank);
}
