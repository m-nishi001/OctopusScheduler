import { injectable, inject } from "tsyringe";
import type { Prize } from "../prize/prize";
import {
  RandomProviderToken,
  type RandomProvider,
} from "../common/random-provider";

@injectable()
export class PrizeReservationService {
  private rand: RandomProvider;

  constructor(@inject(RandomProviderToken) rand: RandomProvider) {
    this.rand = rand;
  }

  /**
   * Calculate two nearby kakuhen timings around the halfway point.
   * Returns unique, sorted timings in the range [1..totalPrizes].
   */
  calculateKakuhenTimings(totalPrizes: number): number[] {
    if (totalPrizes <= 0) return [];
    const center = Math.max(1, Math.floor(totalPrizes / 2));
    const t1 = Math.min(Math.max(center, 1), totalPrizes);
    const t2 = Math.min(Math.max(center + 1, 1), totalPrizes);
    return [t1, t2]
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b);
  }

  private createPool(reservedCount: number, prizes: Prize[]) {
    // sort by rank descending
    const sortedHigh = [...prizes].sort(
      (a, b) => (b.rank ?? 0) - (a.rank ?? 0)
    );

    // number to take from each side
    const sideCount = Math.min(
      prizes.length,
      Math.max(1, Math.ceil(reservedCount / 2))
    );
    const topHigh = sortedHigh.slice(0, sideCount);
    const topLow = sortedHigh.slice(-sideCount).reverse();

    // pool: unique union of both sides (preserve order)
    const pool = Array.from(
      new Map([...topHigh, ...topLow].map((p) => [p.id, p])).values()
    );

    return { topHigh, topLow, pool };
  }

  /**
   * Reserve `reservedCount` prizes from `prizes` using a heuristic that prefers
   * higher-ranked items but mixes from different ends. Uses RandomProvider for
   * all randomness so behavior can be deterministic in tests.
   */
  reservePrizes(reservedCount: number, prizes: Prize[]): Prize[] {
    if (reservedCount <= 0) return [];
    if (reservedCount >= prizes.length) {
      throw new Error(
        `reservedCount (${reservedCount}) must be less than number of prizes (${prizes.length})`
      );
    }

    const { topHigh, topLow, pool } = this.createPool(reservedCount, prizes);

    const pickPrize = (
      arr: Prize[],
      exclude = new Set<string>(),
      pref = 0
    ): Prize | null => {
      const candidates = arr.filter((p) => !exclude.has(p.id));
      if (candidates.length === 0) return null;
      if (pref === 0) return candidates[this.rand.nextInt(candidates.length)];
      const ranks = candidates.map((p) => p.rank ?? 0);
      const target = pref > 0 ? Math.max(...ranks) : Math.min(...ranks);
      const filtered = candidates.filter((p) => (p.rank ?? 0) === target);
      return filtered[this.rand.nextInt(filtered.length)];
    };

    const pickHighFirst = this.rand.next() < 0.5;
    const sequence: { arr: Prize[]; pref: number }[] = [
      { arr: pickHighFirst ? topHigh : topLow, pref: pickHighFirst ? 1 : -1 },
      { arr: pickHighFirst ? topLow : topHigh, pref: pickHighFirst ? -1 : 1 },
      { arr: pool, pref: 0 },
      { arr: prizes, pref: 0 },
    ];

    const chosenIds = new Set<string>();
    const result: Prize[] = [];

    while (result.length < reservedCount) {
      let picked: Prize | null = null;
      for (const s of sequence) {
        picked = pickPrize(s.arr, chosenIds, s.pref);
        if (picked) break;
      }
      if (!picked) break;
      result.push(picked);
      chosenIds.add(picked.id);
    }

    return result.map((p) => ({ ...p }));
  }
}
