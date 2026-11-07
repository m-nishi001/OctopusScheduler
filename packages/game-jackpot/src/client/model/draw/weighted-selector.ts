import { injectable, inject } from "tsyringe";
import { MathRandomProvider } from "../common/math-random-provider";

/** メンバー抽選の当選しやすさ（重み）が未設定のときの既定値と範囲（1〜10、標準5）。 */
export const DEFAULT_WEIGHT = 5;
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 10;

/**
 * 重み（メンバーの当選しやすさ。景品はランクから求めた重み）を 1〜10 の整数に正規化する。範囲外・不正値はクランプ/既定値で補う。
 */
export function resolveWeight(weight: number | undefined): number {
  let w = weight ?? DEFAULT_WEIGHT;
  if (Number.isNaN(w) || !isFinite(w)) w = DEFAULT_WEIGHT;
  if (w < MIN_WEIGHT) w = MIN_WEIGHT;
  if (w > MAX_WEIGHT) w = MAX_WEIGHT;
  return Math.floor(w);
}

/** 重みに応じた抽選。景品とメンバーで同じ規則を使う。 */
@injectable()
export class WeightedSelector {
  private rand: MathRandomProvider;

  constructor(@inject(MathRandomProvider) rand: MathRandomProvider) {
    this.rand = rand;
  }

  /**
   * 重みの累積和選択（景品・メンバー共通）。重みが大きいほど当選しやすい。
   * 重みは既定で `weight`（メンバーの当選しやすさ）。景品は `weightOf` でランクから求めた重みを渡す。
   * 重みが無いものは既定値（{@link DEFAULT_WEIGHT}）として扱うので、全員が無指定なら均等になる。
   */
  selectWeighted<T>(pool: T[], weightOf: (item: T) => number | undefined = (p) => (p as { weight?: number }).weight): T {
    if (pool.length === 0) {
      throw new Error("Pool is empty");
    }
    const weights = pool.map((p) => resolveWeight(weightOf(p)));
    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) {
      // fallback to uniform random if something unexpected happens
      const idx = this.rand.nextInt(pool.length);
      return pool[idx];
    }
    // get a float in [0, total)
    const r = this.rand.next() * total;
    let acc = 0;
    for (let i = 0; i < pool.length; i++) {
      acc += weights[i];
      if (r < acc) return pool[i];
    }
    // numerical edge: return last
    return pool[pool.length - 1];
  }
}
