import { WeightedSelector } from "./weighted-selector";
import { MemberDrawService } from "./member-draw-service";
import { PrizeDrawService } from "./prize-draw-service";
import { injectable } from "tsyringe";
import { toMember } from "../../applications/member/dto/member-dto";
import { toPrize } from "../../applications/prize/dto/prize-dto";
import type { MemberDto } from "../../applications/member/dto/member-dto";
import type { PrizeDto } from "../../applications/prize/dto/prize-dto";
import type { Prize } from "../../domains/prize/prize";
import type { DrawResult } from "./draw-result";

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
    return this.prizeDrawService.executePrizeDraw(opts);
  }

  updateDrawResult(opts: {
    drawId: string;
    prizeId: string;
    prizes: { id: string; [key: string]: any }[];
    results: { drawId: string; wonPrize?: any }[];
    updateFn: (result: any) => void;
  }): void {
    const { drawId, prizeId, prizes, results, updateFn } = opts;
    const prize = prizes.find((p) => p.id === prizeId);
    const existingResult = results.find((r) => r.drawId === drawId);

    if (existingResult) {
      existingResult.wonPrize = prize || null;
      updateFn(existingResult);
    } else {
      throw new Error(`Draw result with drawId ${drawId} not found`);
    }
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
