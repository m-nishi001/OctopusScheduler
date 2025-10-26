import { WeightedSelector } from "./weighted-selector";

export class MemberDrawService {
  private weightedSelector: WeightedSelector;

  constructor(weightedSelector: WeightedSelector) {
    this.weightedSelector = weightedSelector;
  }

  drawMember(opts: {
    members: {
      id: string;
      rank: number;
      isWinner: boolean;
    }[];
    requestDummyCount: number;
  }): { winnerId: string | null; dummyIds: string[] } {
    const { members, requestDummyCount } = opts;
    const candidates = members.filter((m) => !m.isWinner);
    if (candidates.length === 0) {
      return {
        winnerId: null,
        dummyIds: this.getDummyMember(
          members.map((m) => m.id),
          requestDummyCount
        ),
      };
    }
    const weighted = candidates.map((m) => ({
      id: m.id,
      weight: 1,
    }));
    const winner = this.weightedSelector.selectWeighted(weighted);
    const dummyPool = members.map((m) => m.id).filter((id) => id !== winner.id);
    return {
      winnerId: winner.id,
      dummyIds: this.getDummyMember(dummyPool, requestDummyCount),
    };
  }

  private getDummyMember(poolIds: string[], count: number): string[] {
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
