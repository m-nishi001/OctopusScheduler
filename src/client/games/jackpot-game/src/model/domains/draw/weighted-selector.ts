import { injectable, inject } from "tsyringe";
import {
  RandomProviderToken,
  type RandomProvider,
} from "../common/random-provider";

@injectable()
export class WeightedSelector {
  private rand: RandomProvider;

  constructor(@inject(RandomProviderToken) rand: RandomProvider) {
    this.rand = rand;
  }

  selectWeighted<T extends { rank?: number }>(pool: T[]): T {
    if (pool.length === 0) {
      throw new Error("Pool is empty");
    }
    // Treat rank as weight: higher rank -> higher chance.
    // Normalize ranks into [1..10] and use cumulative-sum selection.
    const weights = pool.map((p) => {
      let r = p.rank ?? 1;
      if (Number.isNaN(r) || !isFinite(r)) r = 1;
      // clamp to [1,10]
      if (r < 1) r = 1;
      if (r > 10) r = 10;
      return Math.floor(r);
    });
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

  shuffleWithWeights<T extends { rank?: number }>(items: T[]): T[] {
    // Sort by rank descending (higher rank first)
    const sorted = [...items].sort(
      (a, b) => (b.rank ?? -Infinity) - (a.rank ?? -Infinity)
    );
    // Shuffle within same rank groups
    const result: T[] = [];
    let currentRank: number | undefined;
    let group: T[] = [];
    for (const item of sorted) {
      const rank = item.rank ?? Infinity;
      if (rank !== currentRank) {
        if (group.length > 0) {
          // Shuffle the previous group using RandomProvider
          for (let i = group.length - 1; i > 0; i--) {
            const j = this.rand.nextInt(i + 1);
            [group[i], group[j]] = [group[j], group[i]];
          }
          result.push(...group);
        }
        group = [item];
        currentRank = rank;
      } else {
        group.push(item);
      }
    }
    if (group.length > 0) {
      // Shuffle the last group
      for (let i = group.length - 1; i > 0; i--) {
        const j = this.rand.nextInt(i + 1);
        [group[i], group[j]] = [group[j], group[i]];
      }
      result.push(...group);
    }
    return result;
  }
}
