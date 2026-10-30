/**
 * メンバー抽選のリール(横に流れるメンバーの列)の、画面に依存しない計算。
 * DOM の計測値(位置・大きさ)は呼び出し側が渡す。
 */
import type { MemberDto } from '@control/member/dto/member-dto';

/** リールの列を何回繰り返して並べるか(無限に流れて見えるようにするため)。 */
export const REEL_REPEAT = 10;

/** 表示数に満たないときに埋める、空の枠。 */
export function emptyReelMember(index: number): MemberDto {
  return { id: `empty-${index}`, name: '---', rank: 0 } as MemberDto;
}

/**
 * 1周ぶんの列を作る。当選者(あれば)は他の人の間のランダムな位置に入れ、表示数に満たなければ空の枠で埋める。
 * @param others 当選者以外の並べるメンバー(順番はそのまま使う)
 * @param winner 当選者(未定なら null)
 * @param random 0以上1未満の乱数(テストでは固定する)
 * @param options.unique true なら同じ id を1つにまとめる
 */
export function buildReelLap(
  others: readonly MemberDto[],
  winner: MemberDto | null,
  visibleCount: number,
  random: () => number,
  options: { unique?: boolean } = {}
): MemberDto[] {
  const list = [...others];
  if (winner) list.splice(Math.floor(random() * (list.length + 1)), 0, winner);
  while (list.length < visibleCount) list.push(emptyReelMember(list.length));
  if (!options.unique) return list;
  const seen = new Set<string>();
  return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

/** 1周ぶんの列を `REEL_REPEAT` 回つなげる。 */
export function repeatReel(lap: readonly MemberDto[]): MemberDto[] {
  return Array.from({ length: REEL_REPEAT }, () => lap).flat();
}

/** 中央に近いほど大きく見せる拡大率。`distance` は中央までの距離、`influence` はこの距離で最小になる。 */
export function reelScale(distance: number, influence: number, range = { min: 0.8, max: 1.8 }): number {
  const ratio = Math.min(1, distance / Math.max(1, influence));
  return Number((range.min + (1 - ratio) * (range.max - range.min)).toFixed(3));
}

/**
 * 「開始」ボタンの縦位置(ボタン中心の y)。選ばれている枠の中心と画面の下端の中間に置き、
 * 画面の外に出ないよう余白を残して収め、少し下に寄せる。
 */
export function startButtonCenterY(activeCenterY: number, innerHeight: number, buttonHeight: number): number {
  const padding = 12;
  const nudgeDown = 40;
  const midpoint = (activeCenterY + innerHeight) / 2;
  const min = buttonHeight / 2 + padding;
  const max = innerHeight - buttonHeight / 2 - padding;
  const clamped = Math.max(min, Math.min(midpoint, max));
  return Math.min(clamped + nudgeDown, max);
}
