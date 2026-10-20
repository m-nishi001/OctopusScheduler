import { injectable, inject } from "tsyringe";
import { MathRandomProvider } from "../common/math-random-provider";

/** 重み（当選しやすさ）が未設定のときの既定値。景品もメンバーも同じ規則。 */
export const DEFAULT_WEIGHT = 10;
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 100;

/**
 * 当選確率の重み（景品・メンバー共通）を 1〜100 の整数に正規化する。範囲外・不正値はクランプ/既定値で補う。
 */
export function resolveWeight(weight: number | undefined): number {
  let w = weight ?? DEFAULT_WEIGHT;
  if (Number.isNaN(w) || !isFinite(w)) w = DEFAULT_WEIGHT;
  if (w < MIN_WEIGHT) w = MIN_WEIGHT;
  if (w > MAX_WEIGHT) w = MAX_WEIGHT;
  return Math.floor(w);
}

/** 重み(当選しやすさ)に応じた抽選。景品とメンバーで同じ規則を使う。 */
@injectable()
export class WeightedSelector {
  private rand: MathRandomProvider;

  constructor(@inject(MathRandomProvider) rand: MathRandomProvider) {
    this.rand = rand;
  }

  /**
   * `weight` を重みとした累積和選択（景品・メンバー共通）。重みが大きいほど当選しやすい。
   * 重みが無いものは既定値（{@link DEFAULT_WEIGHT}）として扱うので、全員が無指定なら均等になる。
   */
  selectWeighted<T extends { weight?: number }>(pool: T[]): T {
    if (pool.length === 0) {
      throw new Error("Pool is empty");
    }
    const weights = pool.map((p) => resolveWeight(p.weight));
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
