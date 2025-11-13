import { WeightedSelector } from "./weighted-selector";
import { injectable, inject } from "tsyringe";
import type { Prize } from "../prize/prize";
import type { Member } from "../member/member";
import type { RandomProvider } from "../common/random-provider";
import { RandomProviderToken } from "../common/random-provider";
import { NoReservedPrizesError } from "../../common/errors";

@injectable()
export class PrizeDrawService {
  private weightedSelector: WeightedSelector;
  private rand: RandomProvider;

  constructor(
    @inject(WeightedSelector) weightedSelector: WeightedSelector,
    @inject(RandomProviderToken) rand: RandomProvider
  ) {
    this.weightedSelector = weightedSelector;
    this.rand = rand;
  }

  /**
   * Filter out prizes that have already been assigned in draw results.
   */
  getAvailablePrizes(
    prizes: Prize[],
    results: { wonPrize?: Prize | null; wonMember?: any }[]
  ): Prize[] {
    return prizes.filter(
      (p) =>
        !results.some((r) => r.wonPrize?.id === p.id && r.wonMember !== null)
    );
  }

  selectRandomReserved<T extends { drawId: string }>(reservedResults: T[]): T {
    if (!reservedResults || reservedResults.length === 0)
      throw new NoReservedPrizesError("No reserved results to select from");
    const idx = this.rand.nextInt(reservedResults.length);
    return reservedResults[idx];
  }

  /**
   * Calculate remaining prizes by excluding assigned prize ids from results.
   * This is a pure function and helps move filtering logic out of the application layer.
   */
  getRemainingPrizes(
    prizes: Prize[],
    results: { wonPrize?: Prize | null; wonMember?: any; drawId?: string }[]
  ): Prize[] {
    const assignedPrizeIds = results.reduce((set, r) => {
      const hasWinner = !!r.wonMember;
      const isNotReserved = !(r.drawId && r.drawId.startsWith("reserved-"));
      const hasPrizeId = !!r.wonPrize?.id;
      const isAssigned = hasWinner && isNotReserved && hasPrizeId;
      if (isAssigned) {
        set.add(r.wonPrize!.id);
      }
      return set;
    }, new Set<string>());
    return prizes.filter((p) => !assignedPrizeIds.has(p.id));
  }

  pickRandomPrizeFrom(prizes: Prize[]): Prize | null {
    if (!prizes || prizes.length === 0) return null;
    return prizes[this.rand.nextInt(prizes.length)];
  }

  /**
   * Build dummy prize ids by excluding provided ids and then sampling up to requiredSize.
   */
  buildDummyPrizeIds(
    prizes: Prize[],
    excludedIds: Set<string | null | undefined>,
    requiredSize: number
  ): string[] {
    const dummyCandidates = prizes.filter((p) => !excludedIds.has(p.id));
    // shuffle using Fisher-Yates with provided random provider for determinism in tests
    const rand = this.rand;
    const arr = [...dummyCandidates];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rand.nextInt(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr.slice(0, requiredSize).map((p) => p.id);
  }

  drawPrize(opts: {
    prizes: Prize[];
    assignedPrizeIds: string[];
    member: Member;
    dummyCount: number;
  }): { winnerPrizeId: string | null; dummyPrizeIds: string[] } | null {
    const { prizes, assignedPrizeIds } = opts;

    const available = prizes.filter((p) => !assignedPrizeIds.includes(p.id));
    if (available.length === 0) return null;

    const picked = this.weightedSelector.selectWeighted(available);
    const dummyPool = prizes.map((p) => p.id).filter((id) => id !== picked.id);
    return {
      winnerPrizeId: picked.id,
      dummyPrizeIds: this.getDummyPrize(dummyPool, opts.dummyCount),
    };
  }

  /**
   * Decide whether the current draw should use kakuhen (reserved) logic.
   * This encapsulates the "total - remaining + 1" calculation and state check.
   */
  isKakuhenTurn(
    prizes: Prize[],
    results: { wonPrize?: Prize | null; wonMember?: any; drawId?: string }[],
    state: number[]
  ): boolean {
    const total = prizes.length;
    const remaining = this.getRemainingPrizes(prizes, results).length;
    const drawCount = total - remaining + 1;
    return state.includes(drawCount);
  }

  private getDummyPrize(poolIds: string[], count: number): string[] {
    const ids = [...poolIds];
    const res: string[] = [];
    const rand = this.rand;
    while (res.length < count && ids.length > 0) {
      const idx = rand.nextInt(ids.length);
      res.push(ids[idx]);
      ids.splice(idx, 1);
    }
    while (res.length < count && poolIds.length > 0) {
      const idx = rand.nextInt(poolIds.length);
      res.push(poolIds[idx]);
    }
    return res;
  }
}
