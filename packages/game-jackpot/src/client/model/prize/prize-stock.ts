import { isDrawablePrize } from "./prize";
import type { Prize } from "./prize";

/** 景品ごとの当選状況。`remaining` は、当選対象でない景品は引かれないので null(数えない)。 */
export interface PrizeStock {
  wins: number;
  remaining: number | null;
}

/** 景品1つの当選回数と残り。当選対象の景品は1回当たれば0、まだなら1。 */
export const prizeStock = (prize: Pick<Prize, "id" | "drawable">, wonPrizeIds: ReadonlyArray<string>): PrizeStock => {
  const wins = wonPrizeIds.filter((id) => id === prize.id).length;
  return { wins, remaining: isDrawablePrize(prize) ? (wins > 0 ? 0 : 1) : null };
};

/** 景品残数: まだ当たっていない「当選対象」の景品の数。 */
export const remainingPrizeCount = (
  prizes: ReadonlyArray<Pick<Prize, "id" | "drawable">>,
  wonPrizeIds: ReadonlyArray<string>
): number => prizes.reduce((n, p) => n + (prizeStock(p, wonPrizeIds).remaining ?? 0), 0);
