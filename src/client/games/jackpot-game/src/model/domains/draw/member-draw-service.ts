import { WeightedSelector } from "./weighted-selector";
import type { DrawResult } from "./draw-result";
import type { Member } from "../member/member";

export class MemberDrawService {
  private weightedSelector: WeightedSelector;

  constructor(weightedSelector: WeightedSelector) {
    this.weightedSelector = weightedSelector;
  }

  drawMember(
    members: Member[],
    drawResults: DrawResult[],
    dummyCount: number
  ): { winnerId: string | null; dummyIds: string[] } | null {
    const candidates = members.filter(
      (m) => !drawResults.some((dr) => dr.wonMember?.id === m.id)
    );
    if (candidates.length === 0) {
      return null;
    }
    const winner = this.weightedSelector.selectWeighted(candidates);
    const dummyPool = members.map((m) => m.id).filter((id) => id !== winner.id);
    return {
      winnerId: winner.id,
      dummyIds: this.getDummyMember(dummyPool, dummyCount),
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
