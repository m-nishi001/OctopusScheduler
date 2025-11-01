import { WeightedSelector } from "./weighted-selector";
import { injectable } from "tsyringe";
import type { Prize } from "../prize/prize";
import type { Member } from "../member/member";

@injectable()
export class PrizeDrawService {
  private weightedSelector: WeightedSelector;

  constructor(weightedSelector: WeightedSelector) {
    this.weightedSelector = weightedSelector;
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

  private getDummyPrize(poolIds: string[], count: number): string[] {
    const ids = [...poolIds];
    const res: string[] = [];
    while (res.length < count && ids.length > 0) {
      const idx = Math.floor(Math.random() * ids.length);
      res.push(ids[idx]);
      ids.splice(idx, 1);
    }
    while (res.length < count && poolIds.length > 0) {
      const idx = Math.floor(Math.random() * poolIds.length);
      res.push(poolIds[idx]);
    }
    return res;
  }
}
