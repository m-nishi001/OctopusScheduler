import { PrizeDrawService } from "./prize-draw-service";
import { KakuhenService } from "./kakuhen-service";

export class DrawStateManager {
  private prizeDrawService: PrizeDrawService;

  constructor(
    prizeDrawService: PrizeDrawService,
    _kakuhenService: KakuhenService
  ) {
    this.prizeDrawService = prizeDrawService;
  }

  getLastPrizeCount(prizes: { isAssigned?: boolean }[]): {
    total: number;
    remaining: number;
  } {
    const total = prizes.length;
    const remaining = prizes.filter((p) => !p.isAssigned).length;
    return { total, remaining };
  }

  initializePrizeDrawState(availablePrizes: { id: string; rank?: number }[]): {
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
    prizes: {
      id: string;
      weight: number;
      rank?: number;
      isAssigned?: boolean;
    }[];
    memberRank: number;
    requestDummyCount: number;
    currentState: {
      kakuhenTimings: number[];
    };
  }): {
    winnerPrizeId: string | null;
    dummyPrizeIds: string[];
    isKakuhen: boolean;
  } {
    const { prizes, memberRank, requestDummyCount, currentState } = opts;

    if (currentState.kakuhenTimings.includes(0)) {
      // Placeholder, actual check in app service
      // Kakuhen draw - handled in app service
      const trial = this.prizeDrawService.drawPrize({
        prizes: prizes.map((p) => ({
          id: p.id,
          weight: p.weight,
          rank: p.rank,
        })),
        memberRank,
        requestDummyCount: Math.max(0, requestDummyCount - 1),
      });

      return {
        winnerPrizeId: null, // assigned in app service
        dummyPrizeIds: trial.dummyPrizeIds,
        isKakuhen: true,
      };
    } else {
      // Normal draw
      const pick = this.prizeDrawService.drawPrize({
        prizes: prizes.map((p) => ({
          id: p.id,
          weight: p.weight,
          rank: p.rank,
          isAssigned: p.isAssigned,
        })),
        memberRank,
        requestDummyCount: Math.max(0, requestDummyCount - 1),
      });

      return {
        winnerPrizeId: pick.winnerPrizeId,
        dummyPrizeIds: pick.dummyPrizeIds,
        isKakuhen: false,
      };
    }
  }
}
