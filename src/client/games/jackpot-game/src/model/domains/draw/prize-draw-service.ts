import { WeightedSelector } from "./weighted-selector";
import type { Prize } from "../prize/prize";
import type { Member } from "../member/member";

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
    const { prizes, assignedPrizeIds, dummyCount } = opts;

    const available = prizes.filter((p) => !assignedPrizeIds.includes(p.id));
    if (available.length === 0) return null;

    const picked = this.weightedSelector.selectWeighted(available);
    const dummyPool = prizes.map((p) => p.id).filter((id) => id !== picked.id);
    return {
      winnerPrizeId: picked.id,
      dummyPrizeIds: this.getDummyPrize(dummyPool, dummyCount),
    };
  }

  executePrizeDraw(opts: {
    prizes: Prize[];
    assignedPrizeIds: string[];
    dummyCount: number;
    currentState: {
      kakuhenTimings: number[];
    };
  }): {
    winnerPrizeId: string | null;
    dummyPrizeIds: string[];
    isKakuhen: boolean;
  } {
    const { prizes, assignedPrizeIds, dummyCount, currentState } = opts;

    if (currentState.kakuhenTimings.includes(0)) {
      // Placeholder, actual check in app service
      // Kakuhen draw - handled in app service
      const trial = this.drawPrize({
        prizes: prizes,
        assignedPrizeIds: assignedPrizeIds,
        member: {} as any, // TODO: pass member
        dummyCount: Math.max(0, dummyCount - 1),
      });

      if (!trial) {
        throw new Error("No prizes available for kakuhen draw");
      }

      return {
        winnerPrizeId: null, // assigned in app service
        dummyPrizeIds: trial.dummyPrizeIds,
        isKakuhen: true,
      };
    } else {
      // Normal draw
      const pick = this.drawPrize({
        prizes: prizes,
        assignedPrizeIds: assignedPrizeIds,
        member: {} as any, // TODO: pass member
        dummyCount: Math.max(0, dummyCount - 1),
      });

      if (!pick) {
        return {
          winnerPrizeId: null,
          dummyPrizeIds: [],
          isKakuhen: false,
        };
      }

      return {
        winnerPrizeId: pick.winnerPrizeId,
        dummyPrizeIds: pick.dummyPrizeIds,
        isKakuhen: false,
      };
    }
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
