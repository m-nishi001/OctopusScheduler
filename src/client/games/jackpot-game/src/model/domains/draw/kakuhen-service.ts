export class KakuhenService {
  executeKakuhenAssign(opts: { reservedPrizeIds: string[] }): {
    winnerPrizeId: string | null;
    reservedPrizeIds: string[];
  } {
    if (!opts.reservedPrizeIds.length) {
      return {
        winnerPrizeId: null,
        reservedPrizeIds: [],
      };
    }

    const prizeId = opts.reservedPrizeIds.shift()!;
    return {
      winnerPrizeId: prizeId,
      reservedPrizeIds: opts.reservedPrizeIds,
    };
  }
}
