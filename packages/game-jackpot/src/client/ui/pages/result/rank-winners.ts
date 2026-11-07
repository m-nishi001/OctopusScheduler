import { resolvePrizeRank } from "@model/prize/prize-rank";

/** 結果1件のうち、特別表示の判定に使う部分(当選者と、当たった景品のランク)。 */
interface RankedResult<M> {
  wonMember?: M | null;
  wonPrize?: { rank?: number } | null;
}

/**
 * 結果画面の特別表示。当たった景品のランクで決める:
 * 最もランクの高い景品の当選者が `special`、最もランクの低い景品の当選者が `lowest`(同順位は先に出た人)。
 * 景品のランクがすべて同じなら、差が無いので両方とも付けない。
 */
export function pickRankWinners<M>(results: ReadonlyArray<RankedResult<M>>): { special?: M; lowest?: M } {
  const winners = results.filter((r): r is RankedResult<M> & { wonMember: M } => !!r.wonMember && !!r.wonPrize);
  if (winners.length === 0) return {};
  const ranks = winners.map((r) => resolvePrizeRank(r.wonPrize!.rank));
  const top = Math.max(...ranks);
  const bottom = Math.min(...ranks);
  if (top === bottom) return {};
  return {
    special: winners[ranks.indexOf(top)].wonMember,
    lowest: winners[ranks.indexOf(bottom)].wonMember,
  };
}
