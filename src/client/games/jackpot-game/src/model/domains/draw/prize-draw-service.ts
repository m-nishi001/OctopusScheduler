import { WeightedSelector } from "./weighted-selector";

export class PrizeDrawService {
  private weightedSelector: WeightedSelector;

  constructor(weightedSelector: WeightedSelector) {
    this.weightedSelector = weightedSelector;
  }

  drawPrize(opts: {
    prizes: {
      id: string;
      weight: number;
      rank?: number;
      isAssigned?: boolean;
    }[];
    memberRank?: number;
    requestDummyCount: number;
    preferModeRank?: number | null;
  }): { winnerPrizeId: string | null; dummyPrizeIds: string[] } {
    const { prizes, memberRank, requestDummyCount, preferModeRank } = opts;
    let available = prizes.filter((p) => !p.isAssigned);
    if (preferModeRank !== null && preferModeRank !== undefined) {
      available = available.filter((p) => p.rank === preferModeRank);
      if (available.length === 0) {
        // Fallback to all available if no prizes match the mode rank
        available = prizes.filter((p) => !p.isAssigned);
      }
    }
    if (available.length === 0) {
      return {
        winnerPrizeId: null,
        dummyPrizeIds: this.getDummyPrize(
          prizes.map((p) => p.id),
          requestDummyCount
        ),
      };
    }
    const weighted = available.map((p) => {
      const base = p.weight;
      const rankFactor =
        memberRank && p.rank ? 1 + (memberRank - p.rank) * 0.1 : 1;
      return { id: p.id, weight: Math.max(0, base * rankFactor) };
    });
    const picked = this.weightedSelector.selectWeighted(weighted);
    const dummyPool = prizes.map((p) => p.id).filter((id) => id !== picked.id);
    return {
      winnerPrizeId: picked.id,
      dummyPrizeIds: this.getDummyPrize(dummyPool, requestDummyCount),
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
