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
import type { Member } from "../../domains/member/member";
import type { Prize } from "../../domains/prize/prize";
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

  drawPrize(opts: {
    prizes: Prize[];
    assignedPrizeIds: string[];
    member: Member;
    dummyCount: number;
  }): { winnerPrizeId: string | null; dummyPrizeIds: string[] } | null {
    return this.prizeDrawService.drawPrize(opts);
  }

  drawMember(
    members: Member[],
    drawResults: DrawResult[],
    dummyCount: number
  ): { winnerId: string | null; dummyIds: string[] } | null {
    return this.memberDrawService.drawMember(members, drawResults, dummyCount);
  }

  getLastPrizeCount(
    prizes: Prize[],
    assignedPrizeIds: string[]
  ): {
    total: number;
    remaining: number;
  } {
    return this.drawStateManager.getLastPrizeCount(prizes, assignedPrizeIds);
  }

  initializePrizeDrawState(availablePrizes: Prize[]): {
    kakuhenTimings: number[];
  } {
    return this.drawStateManager.initializePrizeDrawState(availablePrizes);
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
    return this.drawStateManager.executePrizeDraw(opts);
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
    return this.kakuhenService.executeKakuhenAssign(opts);
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
    const prizeResult = this.drawPrize(prizeOpts);
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
