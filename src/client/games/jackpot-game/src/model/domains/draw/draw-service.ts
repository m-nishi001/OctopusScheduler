import { WeightedSelector } from "./weighted-selector";
import { MemberDrawService } from "./member-draw-service";
import { PrizeDrawService } from "./prize-draw-service";
import { injectable } from "tsyringe";
import { toMember } from "../../applications/member/dto/member-dto";
import { toPrize } from "../../applications/prize/dto/prize-dto";
import type { MemberDto } from "../../applications/member/dto/member-dto";
import type { PrizeDto } from "../../applications/prize/dto/prize-dto";
import type { DrawResult } from "./draw-result";
import type { Prize } from "../prize/prize";

@injectable()
export class DrawService {
  private weightedSelector: WeightedSelector;
  private memberDrawService: MemberDrawService;
  private prizeDrawService: PrizeDrawService;

  constructor() {
    this.weightedSelector = new WeightedSelector();
    this.memberDrawService = new MemberDrawService(this.weightedSelector);
    this.prizeDrawService = new PrizeDrawService(this.weightedSelector);
  }

  calculateKakuhenTimings(totalPrizes: number): number[] {
    // Kakuhen timings: one in first half, one in second half
    const half = Math.floor(totalPrizes / 2);
    const firstHalfEnd = half;
    const secondHalfStart = half + 1;
    const t1 =
      firstHalfEnd > 3
        ? Math.floor(Math.random() * (firstHalfEnd - 3)) + 4
        : null;
    const t2 =
      totalPrizes > secondHalfStart
        ? Math.floor(Math.random() * (totalPrizes - secondHalfStart)) +
          secondHalfStart
        : null;

    return [t1, t2].filter(Boolean) as number[];
  }

  reservePrizes(state: number[], prizes: Prize[]): DrawResult[] {
    const reservedCount = state.length;
    const sortedHigh = [...prizes].sort(
      (a, b) => (b.rank ?? 0) - (a.rank ?? 0)
    );
    const sortedLow = [...sortedHigh].reverse();
    const reservedPrizes: Prize[] = [];
    const isEven = reservedCount % 2 === 0;
    let useHigh = isEven ? true : Math.random() < 0.5;
    for (let i = 0; i < reservedCount; i++) {
      const source = useHigh ? sortedHigh : sortedLow;
      const candidate = source.find(
        (p) => !reservedPrizes.some((rp) => rp.id === p.id)
      );
      reservedPrizes.push(
        candidate || prizes[Math.floor(Math.random() * prizes.length)]
      );
      useHigh = !useHigh;
    }
    return reservedPrizes.map((prize) => ({
      drawId: `reserved-${prize.id}-${Date.now()}`,
      wonMember: null,
      wonPrize: prize,
      isKakuhen: false,
    }));
  }

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

  async executeDraw(opts: {
    prizes: PrizeDto[];
    members: MemberDto[];
  }): Promise<DrawResult> {
    const members = opts.members.map(toMember);
    const prizes = opts.prizes.map(toPrize);

    // Draw member
    const res = this.memberDrawService.drawMember(members, [], 0);
    const winnerMemberId = res?.winnerId ?? null;
    const winnerMember = members.find((m) => m.id === winnerMemberId)!;

    // Draw prize
    const prizeOpts = {
      prizes: prizes,
      assignedPrizeIds: [],
      member: winnerMember,
      dummyCount: 0,
    };
    const prizeResult = this.prizeDrawService.drawPrize(prizeOpts);
    const winnerPrizeId = prizeResult ? prizeResult.winnerPrizeId : null;
    const winnerPrize = winnerPrizeId
      ? prizes.find((p) => p.id === winnerPrizeId)!
      : null;

    const drawId = crypto.randomUUID();

    const drawResult: DrawResult = {
      drawId,
      wonMember: winnerMember,
      wonPrize: winnerPrize,
      isKakuhen: false,
    };

    return drawResult;
  }
}
