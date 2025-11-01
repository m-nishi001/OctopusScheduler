import { WeightedSelector } from "./weighted-selector";
import { MemberDrawService } from "./member-draw-service";
import { PrizeDrawService } from "./prize-draw-service";
import { DrawStateManager } from "./draw-state-manager";
import { KakuhenService } from "./kakuhen-service";
import { injectable } from "tsyringe";
import { toMember } from "../../applications/member/dto/member-dto";
import { toPrize } from "../../applications/prize/dto/prize-dto";
import type { MemberDto } from "../../applications/member/dto/member-dto";
import type { PrizeDto } from "../../applications/prize/dto/prize-dto";
import type { DrawResult } from "./draw-result";

@injectable()
export class DrawService {
  private weightedSelector: WeightedSelector;
  private memberDrawService: MemberDrawService;
  private prizeDrawService: PrizeDrawService;
  private drawStateManager: DrawStateManager;
  private kakuhenService: KakuhenService;

  constructor() {
    this.weightedSelector = new WeightedSelector();
    this.memberDrawService = new MemberDrawService(this.weightedSelector);
    this.prizeDrawService = new PrizeDrawService(this.weightedSelector);
    this.kakuhenService = new KakuhenService();
    this.drawStateManager = new DrawStateManager(
      this.prizeDrawService,
      this.kakuhenService
    );
  }

  drawMember(opts: {
    members: {
      id: string;
      rank: number;
      isWinner: boolean;
    }[];
    requestDummyCount: number;
  }): { winnerId: string | null; dummyIds: string[] } {
    return this.memberDrawService.drawMember(opts);
  }

  drawPrize(opts: {
    prizes: {
      id: string;
      weight: number;
      rank?: number;
      isAssigned?: boolean;
    }[];
    memberRank?: number;
    requestDummyCount: number;
    preferModeRank?: number | null;
  }): { winnerPrizeId: string | null; dummyPrizeIds: string[] } {
    return this.prizeDrawService.drawPrize(opts);
  }

  getLastPrizeCount(prizes: { isAssigned?: boolean }[]): {
    total: number;
    remaining: number;
  } {
    return this.drawStateManager.getLastPrizeCount(prizes);
  }

  initializePrizeDrawState(availablePrizes: { id: string; rank?: number }[]): {
    total: number;
    remaining: number;
    drawCount: number;
    kakuhenTimings: number[];
    reservedPrizeIds: string[];
    modeRank: number | null;
    initializedAt: string;
  } {
    return this.drawStateManager.initializePrizeDrawState(availablePrizes);
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
      modeRank: number | null;
    };
  }): {
    winnerPrizeId: string | null;
    dummyPrizeIds: string[];
    isKakuhen: boolean;
    reservedPrizeIds: string[];
  } {
    return this.drawStateManager.executePrizeDraw(opts);
  }

  updateDrawResult(opts: {
    drawId: string;
    prizeId: string;
    prizes: { id: string; [key: string]: any }[];
    results: { drawId: string; prize?: any }[];
    updateFn: (result: any) => void;
  }): void {
    const { drawId, prizeId, prizes, results, updateFn } = opts;
    const prize = prizes.find((p) => p.id === prizeId);
    const existingResult = results.find((r) => r.drawId === drawId);

    if (existingResult) {
      existingResult.prize = prize || null;
      updateFn(existingResult);
    } else {
      throw new Error(`Draw result with drawId ${drawId} not found`);
    }
  }

  executeKakuhenAssign(opts: { reservedPrizeIds: string[] }): {
    winnerPrizeId: string | null;
    reservedPrizeIds: string[];
  } {
    return this.kakuhenService.executeKakuhenAssign(opts);
  }

  async executeDraw(opts: {
    prizes: PrizeDto[];
    members: MemberDto[];
  }): Promise<DrawResult> {
    const members = opts.members.map(toMember);
    const prizes = opts.prizes.map(toPrize);

    // Draw member
    const memberOpts = {
      members: members.map((m) => ({
        id: m.id,
        rank: m.rank,
        isWinner: false,
      })),
      requestDummyCount: 0,
    };
    const { winnerId: winnerMemberId } = this.drawMember(memberOpts);
    const winnerMember = members.find((m) => m.id === winnerMemberId)!;

    // Draw prize
    const prizeOpts = {
      prizes: prizes.map((p) => ({
        id: p.id,
        weight: p.probability,
        rank: p.rank,
        isAssigned: p.isAssigned,
      })),
      requestDummyCount: 0,
    };
    const { winnerPrizeId } = this.drawPrize(prizeOpts);
    const winnerPrize = prizes.find((p) => p.id === winnerPrizeId)!;

    const drawId = crypto.randomUUID();

    const drawResult: DrawResult = {
      drawId,
      member: winnerMember,
      prize: winnerPrize,
      prizeRank: winnerPrize.rank ?? null,
      memberRank: winnerMember.rank,
      order: 1,
      isWinner: true,
      isKakuhen: false,
    };

    return drawResult;
  }
}
