import { WeightedSelector } from "./weighted-selector";
import { MemberDrawService } from "./member-draw-service";
import { PrizeDrawService } from "./prize-draw-service";
import { DrawStateManager } from "./draw-state-manager";
import { KakuhenService } from "./kakuhen-service";

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

  // UI-required APIs
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
}
