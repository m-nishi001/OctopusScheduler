/**
 * 1回の抽選の前後の、当選対象の景品の数。数えるのは当選対象(`isDrawablePrize`)の景品だけ
 * (数え方は `PrizeDrawService.getRemainingPrizes` の1か所)。抽選を確定した時点の値で、あとから保存先を読み直して変えない。
 */
export interface PrizeCounts {
  /** 当選対象の景品の数(当選済みを含む)。 */
  total: number;
  /** この抽選の前に残っていた数。 */
  before: number;
  /** この抽選の後に残っている数。 */
  after: number;
}

/**
 * この抽選で、残りの景品が「全体の半分以下」になった(最初の回)か。「あと半分」の知らせを出す回。
 * 半分より多い → 半分以下 に変わった回だけ true なので、奇数でも1度だけ。最後の1個(0個)は終了の画面に任せて false。
 */
export function crossedHalf({ total, before, after }: PrizeCounts): boolean {
  return before * 2 > total && after * 2 <= total && after > 0;
}
