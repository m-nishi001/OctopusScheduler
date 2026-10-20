/**
 * 抽選が終わった理由。
 *   prizes : 景品がすべてなくなった
 *   members: 抽選の対象のメンバーが全員当選した(景品が残っていても、もう抽選できない)
 */
export type DrawEndReason = "prizes" | "members";

/** 抽選の進み具合。終了の判定(endReason)はここ1か所で行い、画面・進行はこれだけを見る。 */
export interface DrawProgress {
  remainingPrizes: number;
  /** 抽選の対象のうち、まだ当選していない人数。 */
  remainingMembers: number;
  /** これまでに当選が決まった回数。 */
  drawn: number;
  /**
   * 終了していれば理由。続けられるなら null。景品もメンバーも尽きたときは prizes。
   * 1回も抽選していないうちは終了にしない(対象の人がいない・景品が無いのは終了ではなく設定の問題。
   * 抽選を試みて、理由の分かるエラーで知らせる)。
   */
  endReason: DrawEndReason | null;
}

/** 抽選の進み具合(残りの景品・残りのメンバー・済んだ回数)から、終了の理由(景品が尽きた / メンバーが尽きた)を決める。1回も引いていなければ終了にしない。 */
export function toDrawProgress(remainingPrizes: number, remainingMembers: number, drawn: number): DrawProgress {
  const exhausted: DrawEndReason | null = remainingPrizes <= 0 ? "prizes" : remainingMembers <= 0 ? "members" : null;
  return { remainingPrizes, remainingMembers, drawn, endReason: drawn > 0 ? exhausted : null };
}
