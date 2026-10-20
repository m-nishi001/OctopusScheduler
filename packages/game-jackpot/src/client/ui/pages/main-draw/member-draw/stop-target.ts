/**
 * メンバー抽選のリールを止める位置の決定（描画から切り離した純粋関数）。
 *
 * リールは同じ顔ぶれを何周分も並べてあるので、同じ参加者が何か所にも並ぶ。止める位置は、
 * その参加者のうち「いま中央にいちばん近いコピー」にする（無駄に長く動かさない）。
 */

/** 止める参加者が、リールの表示の中に無い。別の人で止めず、この例外で止める。 */
export class StopTargetNotFoundError extends Error {
  constructor(memberId: string) {
    super(`メンバー抽選の表示に、当選者(${memberId})がいません`);
    this.name = "StopTargetNotFoundError";
  }
}

/**
 * 止める位置（リール上の何番目か）を返す。
 *
 * @param slotIds       リールに並んでいる参加者の id（並んでいる順。同じ id が何度も現れる）
 * @param memberId      止める参加者。null なら、中央にいちばん近い位置で止める
 * @param distanceToCenter i 番目が中央からどれだけ離れているか（小さいほど近い）
 * @throws {StopTargetNotFoundError} `memberId` を指定したのに、表示の中にいないとき
 */
export function pickStopTarget(
  slotIds: ReadonlyArray<string | null>,
  memberId: string | null,
  distanceToCenter: (index: number) => number
): number {
  const indexes = slotIds.map((_, i) => i).filter((i) => memberId === null || slotIds[i] === memberId);
  if (indexes.length === 0) {
    if (memberId !== null) throw new StopTargetNotFoundError(memberId);
    return -1; // 表示が空
  }
  return indexes.reduce((best, cur) => (distanceToCenter(cur) < distanceToCenter(best) ? cur : best), indexes[0]);
}
