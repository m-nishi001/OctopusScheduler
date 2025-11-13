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
    // Find the minimum rank
    const minRank = Math.min(...pool.map((p) => p.rank ?? Infinity));
    // Filter prizes with the minimum rank
    const candidates = pool.filter((p) => (p.rank ?? Infinity) === minRank);
    // Randomly select from candidates using RandomProvider
    const idx = this.rand.nextInt(candidates.length);
    return candidates[idx];
  }

  shuffleWithWeights<T extends { rank?: number }>(items: T[]): T[] {
    // Sort by rank ascending (lower rank first)
    const sorted = [...items].sort(
      (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)
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
