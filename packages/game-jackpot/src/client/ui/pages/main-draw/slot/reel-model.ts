/**
 * スロットのリール1本ぶんの位置計算(描画から切り離した純粋関数)。
 *
 * 景品の並び(ループ)を輪のように扱う。位置は「上へ流れた距離(px)」で、輪の1周で元に戻る。
 * 描画は「ループ + 窓の高さ分」を並べて、窓がどの位置でも帯の内側に収まるようにする
 * (帯の末尾で位置を0に戻す瞬間も、窓の中身は同じ絵なので継ぎ目が見えない)。
 */

/** 窓に見えるマス数。 */
export const WINDOW_ROWS = 3;
/** ループの最短の長さ。景品が少なくても、流れて見えるように繰り返して埋める。 */
export const MIN_LOOP_LENGTH = 10;

/** 景品を繰り返して、最短の長さ以上のループにする。景品が無ければ空。 */
export function buildLoop<T>(prizes: readonly T[], minLength = MIN_LOOP_LENGTH): T[] {
  if (prizes.length === 0) return [];
  const loop: T[] = [];
  while (loop.length < Math.max(minLength, prizes.length)) loop.push(...prizes);
  return loop.slice(0, Math.max(minLength, prizes.length));
}

/** ループ1周の高さ(px)。 */
export function cycleHeight(loopLength: number, itemHeight: number): number {
  return loopLength * itemHeight;
}

/** 位置を 0 以上 1周未満に収める(負や1周以上の値も正しく折り返す)。 */
export function wrapPosition(position: number, cycle: number): number {
  if (cycle <= 0) return 0;
  return ((position % cycle) + cycle) % cycle;
}

/** 1フレーム進める。速度は px/フレーム。 */
export function advancePosition(position: number, speed: number, cycle: number): number {
  return wrapPosition(position + speed, cycle);
}

/** 描画するマス数。ループ1周 + 窓の高さ分で、窓は常に帯の内側に収まる。 */
export function renderedCount(loopLength: number): number {
  return loopLength === 0 ? 0 : loopLength + WINDOW_ROWS;
}

/** ループ内の景品の位置(最初に現れる所)。見つからなければ -1。 */
export function indexInLoop<T extends { id: string }>(loop: readonly T[], id: string | null | undefined): number {
  return id ? loop.findIndex((p) => p.id === id) : -1;
}

/** 指定したマスを窓の一番上に合わせる位置。 */
export function positionForIndex(index: number, itemHeight: number, cycle: number): number {
  return wrapPosition(index * itemHeight, cycle);
}

/** 位置のとき、窓の下端が帯の末尾を越えないか(空白が映らないか)。 */
export function windowWithinStrip(position: number, loopLength: number, itemHeight: number): boolean {
  return position >= 0 && position + WINDOW_ROWS * itemHeight <= renderedCount(loopLength) * itemHeight;
}
