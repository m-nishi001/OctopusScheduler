/**
 * 未公開の抽選(確定済みでまだ参加者に見せていないもの)の扱い。規則だけの純粋関数。
 *
 * 未公開は確定の古い順に並ぶ。一番古いものが画面で演出中の抽選、2件目が先読みで確定した次の抽選(先読みは1段まで)。
 */

/** ホストを開いた(リロードした)ときの復元。古い分は見せ終えた扱いで公開し、最後の1件だけ演出し直す。 */
export function restorePlan<T>(unrevealed: readonly T[]): { revealFirst: T[]; resume: T | null } {
  if (unrevealed.length === 0) return { revealFirst: [], resume: null };
  return { revealFirst: unrevealed.slice(0, -1), resume: unrevealed[unrevealed.length - 1] };
}

/** 画面で演出中の抽選(onStageDrawId)以外で、一番古い未公開。先読みで確定済みの次の抽選を拾い直すのに使う。無ければ null。 */
export function nextPending<T extends { drawId: string }>(unrevealed: readonly T[], onStageDrawId: string | null | undefined): T | null {
  return unrevealed.find((d) => d.drawId !== onStageDrawId) ?? null;
}
