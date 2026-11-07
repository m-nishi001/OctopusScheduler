import { injectable, inject } from "tsyringe";
import type { Prize } from "../prize/prize";
import { MathRandomProvider } from "../common/math-random-provider";
import { resolvePrizeRank } from "../prize/prize-rank";
import { AUTO_KAKUHEN_PLAN, usableKakuhenTimings } from "./kakuhen-plan";
import type { KakuhenPlan } from "./kakuhen-plan";

/** 確変の準備。確変にする回を決める。確変対応ONの景品を取り置き、確変の回に当てる。 */
@injectable()
export class PrizeReservationService {
  private rand: MathRandomProvider;

  constructor(@inject(MathRandomProvider) rand: MathRandomProvider) {
    this.rand = rand;
  }

  /**
   * 確変にする回（何回目の抽選か。1始まり、小さい順）を決める。
   * おまかせ（既定）は景品の数の真ん中あたりで、`kakuhenCount`（確変対応ONの景品の数）回だけ続けて確変にする。
   * 回数が景品の数以上なら全部の回（景品の数まで）。指定（fixed）は指定した回（範囲外は除く）で、`kakuhenCount` は使わない。
   * `kakuhenCount` を省くと2回。
   */
  calculateKakuhenTimings(totalPrizes: number, plan: KakuhenPlan = AUTO_KAKUHEN_PLAN, kakuhenCount = 2): number[] {
    if (plan.mode === "fixed") return usableKakuhenTimings(plan.fixedTimings, totalPrizes);
    const count = Math.min(Math.max(0, Math.floor(kakuhenCount)), Math.max(0, totalPrizes));
    if (count === 0) return [];
    // 続けてcount回を真ん中に置く。count=2 なら、景品が5件で[2,3]、10件で[5,6]
    const start = Math.floor((totalPrizes - count) / 2) + 1;
    return Array.from({ length: count }, (_, i) => start + i);
  }

  private createPool(reservedCount: number, prizes: Prize[]) {
    // sort by prize rank descending (top rank = rarest first)
    const sortedHigh = [...prizes].sort(
      (a, b) => resolvePrizeRank(b.rank) - resolvePrizeRank(a.rank)
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
      const ranks = candidates.map((p) => resolvePrizeRank(p.rank));
      const target = pref > 0 ? Math.max(...ranks) : Math.min(...ranks);
      const filtered = candidates.filter(
        (p) => resolvePrizeRank(p.rank) === target
      );
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
