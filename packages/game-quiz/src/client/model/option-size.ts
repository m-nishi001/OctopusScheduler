/** 会場スクリーンの選択肢の長さ段階。文字数が多いほど文字を小さくする。選択肢は省略せず、折り返して全文を出す。 */
export type OptionSize = 'short' | 'medium' | 'long';

/** この文字数以下なら short。 */
export const SHORT_MAX_LENGTH = 10;
/** この文字数以下なら medium(超えると long)。 */
export const MEDIUM_MAX_LENGTH = 20;

/** 選択肢の文字数から大きさの段階を決める。 */
export function optionSizeOf(text: string): OptionSize {
  const length = Array.from(text.trim()).length;
  if (length <= SHORT_MAX_LENGTH) return 'short';
  if (length <= MEDIUM_MAX_LENGTH) return 'medium';
  return 'long';
}

/** これより小さい倍率には縮めない。 */
export const MIN_FIT = 0.1;
/** 二分探索の回数(倍率の誤差は 0.9 / 2^7 で 1% 未満)。 */
const FIT_STEPS = 7;

/**
 * 枠に収まる最大の文字の倍率(1 以下)を返す。
 * `fits` は、その倍率にしたときに収まるかを答える(倍率が小さいほど収まりやすいこと)。
 * 最後に呼ぶ `fits` の倍率は戻り値と同じとは限らないので、呼び出し側は戻り値を適用し直すこと。
 */
export function largestFittingScale(fits: (scale: number) => boolean): number {
  if (fits(1)) return 1;
  let low = MIN_FIT;
  let high = 1;
  for (let i = 0; i < FIT_STEPS; i++) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  return low;
}
