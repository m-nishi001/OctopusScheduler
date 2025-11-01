import type { Prize } from "../prize/prize";

export class DrawStateManager {
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
}
