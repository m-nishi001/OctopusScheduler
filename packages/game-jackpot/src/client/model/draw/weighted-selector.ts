import { injectable, inject } from "tsyringe";
import { MathRandomProvider } from "../common/math-random-provider";

/** 景品の重み未設定時に使うデフォルト値。 */
export const DEFAULT_PRIZE_WEIGHT = 10;
export const MIN_PRIZE_WEIGHT = 1;
export const MAX_PRIZE_WEIGHT = 100;

/**
 * 景品の当選確率の重みを正規化する。範囲外・不正値はクランプ/デフォルト値で補う。
 * `prize-reservation-service.ts` や `draw-simulation-service.ts` からも同じ正規化規則を使う。
 */
export function resolvePrizeWeight(weight: number | undefined): number {
  let w = weight ?? DEFAULT_PRIZE_WEIGHT;
  if (Number.isNaN(w) || !isFinite(w)) w = DEFAULT_PRIZE_WEIGHT;
  if (w < MIN_PRIZE_WEIGHT) w = MIN_PRIZE_WEIGHT;
  if (w > MAX_PRIZE_WEIGHT) w = MAX_PRIZE_WEIGHT;
  return Math.floor(w);
}

@injectable()
export class WeightedSelector {
  private rand: MathRandomProvider;

  constructor(@inject(MathRandomProvider) rand: MathRandomProvider) {
    this.rand = rand;
  }

  /**
   * 景品の `weight` を重みとした累積和選択。重みが大きいほど当選しやすい。
   */
  selectWeightedPrize<T extends { weight?: number }>(pool: T[]): T {
    if (pool.length === 0) {
      throw new Error("Pool is empty");
    }
    const weights = pool.map((p) => resolvePrizeWeight(p.weight));
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

  /**
   * 重みを一切考慮しない完全な均等ランダム選択。
   */
  selectUniformRandom<T>(pool: T[]): T {
    if (pool.length === 0) {
      throw new Error("Pool is empty");
    }
    const idx = this.rand.nextInt(pool.length);
    return pool[idx];
  }
}
