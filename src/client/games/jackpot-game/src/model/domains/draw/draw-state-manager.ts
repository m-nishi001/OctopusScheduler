import { PrizeDrawService } from "./prize-draw-service";
import { KakuhenService } from "./kakuhen-service";

export class DrawStateManager {
  private prizeDrawService: PrizeDrawService;
  private kakuhenService: KakuhenService;

  constructor(
    prizeDrawService: PrizeDrawService,
    kakuhenService: KakuhenService
  ) {
    this.prizeDrawService = prizeDrawService;
    this.kakuhenService = kakuhenService;
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
    total: number;
    remaining: number;
    drawCount: number;
    kakuhenTimings: number[];
    reservedPrizeIds: string[];
    initializedAt: string;
  } {
    const total = availablePrizes.length;
    const sortedByRank = [...availablePrizes].sort(
      (a, b) => (b.rank ?? 0) - (a.rank ?? 0)
    );
    const high = sortedByRank.slice(0, 2).map((p) => p.id);
    const low = [...sortedByRank]
      .reverse()
      .slice(0, 2)
      .map((p) => p.id);
    const reserved = Array.from(new Set([...high, ...low]));

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
      total,
      remaining: total,
      drawCount: 0,
      kakuhenTimings: timings,
      reservedPrizeIds: reserved,
      initializedAt: new Date().toISOString(),
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
      drawCount: number;
      kakuhenTimings: number[];
      reservedPrizeIds: string[];
    };
  }): {
    winnerPrizeId: string | null;
    dummyPrizeIds: string[];
    isKakuhen: boolean;
    reservedPrizeIds: string[];
  } {
    const { prizes, memberRank, requestDummyCount, currentState } = opts;

    if (currentState.kakuhenTimings.includes(currentState.drawCount + 1)) {
      // Kakuhen draw
      const assignResult = this.kakuhenService.executeKakuhenAssign({
        reservedPrizeIds: currentState.reservedPrizeIds,
      });
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
        winnerPrizeId: assignResult.winnerPrizeId,
        dummyPrizeIds: trial.dummyPrizeIds,
        isKakuhen: true,
        reservedPrizeIds: assignResult.reservedPrizeIds,
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
        reservedPrizeIds: currentState.reservedPrizeIds,
      };
    }
  }
}
