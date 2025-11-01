import { PrizeDrawService } from "./prize-draw-service";
import { KakuhenService } from "./kakuhen-service";
import type { Prize } from "../prize/prize";

export class DrawStateManager {
  private prizeDrawService: PrizeDrawService;

  constructor(
    prizeDrawService: PrizeDrawService,
    _kakuhenService: KakuhenService
  ) {
    this.prizeDrawService = prizeDrawService;
  }

  getLastPrizeCount(
    prizes: Prize[],
    assignedPrizeIds: string[]
  ): {
    total: number;
    remaining: number;
  } {
    const total = prizes.length;
    const remaining = prizes.filter(
      (p) => !assignedPrizeIds.includes(p.id)
    ).length;
    return { total, remaining };
  }

  initializePrizeDrawState(availablePrizes: Prize[]): {
    kakuhenTimings: number[];
  } {
    const total = availablePrizes.length;

    // Kakuhen timings: one in first half, one in second half
    const half = Math.floor(total / 2);
    const firstHalfEnd = half;
    const secondHalfStart = half + 1;
    const t1 =
      firstHalfEnd > 3
        ? Math.floor(Math.random() * (firstHalfEnd - 3)) + 4
        : null;
    const t2 =
      total > secondHalfStart
        ? Math.floor(Math.random() * (total - secondHalfStart)) +
          secondHalfStart
        : null;
    const timings = [t1, t2].filter(Boolean) as number[];

    return {
      kakuhenTimings: timings,
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
      const trial = this.prizeDrawService.drawPrize({
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
      const pick = this.prizeDrawService.drawPrize({
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
}
