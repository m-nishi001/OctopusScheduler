import { injectable, inject } from "tsyringe";
import { DrawResultService } from "./draw-result-service";
import { MemberDrawService } from "../../domains/draw/member-draw-service";
import { PrizeDrawService } from "../../domains/draw/prize-draw-service";
import type { DrawMemberRequest } from "./dto/draw-member-request";
import type { DrawMemberResponse } from "./dto/draw-member-response";
import type { DrawPrizeRequest } from "./dto/draw-prize-request";
import type { DrawPrizeResponse } from "./dto/draw-prize-response";
import {
  PrizeDrawStateRepository,
  type PrizeDrawState,
} from "../../infrastructures/draw/prize-draw-state-repository";
import type { Prize } from "../../domains/prize/prize";
import type { DrawResultDto } from "./dto/draw-result-dto";
import type { Member } from "../../domains/member/member";
import { IdGeneratorToken } from "../../domains/common/id-generator";
import type { IdGenerator } from "../../domains/common/id-generator";
import {
  NotFoundError,
  StateNotInitializedError,
  NoAvailablePrizesError,
} from "../../common/errors";
import { DrawStateInitializer } from "./draw-state-initializer";
import {
  mapToDrawResult,
  mapToUpdatedDrawResult,
} from "./mappers/draw-result-mapper";
import { IMemberRepositoryToken } from "../../domains/member/repository/i-member-repository";
import { IPrizeRepositoryToken } from "../../domains/prize/repository/i-prize-repository";
import type { IMemberRepository } from "../../domains/member/repository/i-member-repository";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";

@injectable()
export class DrawApplicationService {
  constructor(
    @inject(IMemberRepositoryToken) private memberRepo: IMemberRepository,
    @inject(IPrizeRepositoryToken) private prizeRepo: IPrizeRepository,
    @inject(DrawResultService) private drawResultService: DrawResultService,
    @inject(PrizeDrawStateRepository)
    private prizeDrawStateRepository: PrizeDrawStateRepository,
    @inject(MemberDrawService) private memberDrawService: MemberDrawService,
    @inject(PrizeDrawService) private prizeDrawService: PrizeDrawService,
    @inject(IdGeneratorToken) private idGenerator: IdGenerator,
    @inject(DrawStateInitializer)
    private drawStateInitializer: DrawStateInitializer
  ) {}

  async initializeStateIfNeeded(prizes: Prize[]): Promise<void> {
    return this.drawStateInitializer.initialize(prizes);
  }

  async getRemainingPrizes(): Promise<Prize[]> {
    const prizes = await this.prizeRepo.getPrizes();
    const results = await this.drawResultService.getDrawResults();
    return this.prizeDrawService.getRemainingPrizes(prizes, results);
  }

  /**
   * Return a simple summary of total prizes and remaining prizes.
   * Used by UI code to decide whether to show half/ending dialogs.
   */
  async getLastPrizeCount(): Promise<{ total: number; remaining: number }> {
    const prizes = await this.prizeRepo.getPrizes();
    const results = await this.drawResultService.getDrawResults();
    const remaining = this.prizeDrawService.getRemainingPrizes(
      prizes,
      results
    ).length;
    return { total: prizes.length, remaining };
  }

  async executeDraw(request: {
    memberRequestCount: number;
    prizeRequestCount: number;
  }): Promise<DrawResultDto> {
    const memberRes = await this.executeMemberDraw({
      requestCount: request.memberRequestCount,
    });
    if (!memberRes.winnerId) {
      throw new NotFoundError("No member winner");
    }
    const members = await this.memberRepo.getMembers();
    const winnerMember = members.find((m) => m.id === memberRes.winnerId);
    if (!winnerMember) throw new NotFoundError("Winner member not found");

    const prizes = await this.prizeRepo.getPrizes();
    const results = await this.drawResultService.getDrawResults();
    const state = await this.getPrizeDrawState();
    if (!state)
      throw new StateNotInitializedError("Prize draw state not initialized");
    // const isKakuhen = this.prizeDrawService.isKakuhenTurn(
    //   prizes,
    //   results,
    //   state
    // );
    const isKakuhen = true;

    const prizeRequest = {
      memberId: winnerMember.id,
      requestCount: request.prizeRequestCount,
    };

    const prizeRes = await (isKakuhen
      ? this.executeKakuhenDraw(winnerMember, results, prizes, prizeRequest)
      : this.executeNormalDraw(prizes, results, prizeRequest, winnerMember));

    if (!prizeRes.winnerPrizeId) {
      throw new NoAvailablePrizesError("No prize available");
    }

    const winnerPrize = prizes.find((p) => p.id === prizeRes.winnerPrizeId)!;
    return await this.saveDrawResult(
      prizeRes,
      winnerMember,
      winnerPrize,
      results
    );
  }

  private async getPrizeDrawState(): Promise<PrizeDrawState | null> {
    return await this.prizeDrawStateRepository.getState();
  }

  private async executeKakuhenDraw(
    member: Member,
    results: DrawResultDto[],
    prizes: Prize[],
    request: DrawPrizeRequest
  ): Promise<DrawPrizeResponse> {
    const availablePrizes = this.prizeDrawService.getAvailablePrizes(
      prizes,
      results
    );
    const reservedResults = results.filter((r) => r.wonMember === null);

    if (reservedResults.length === 0) {
      console.warn(
        "DrawApplicationService: No reserved prizes available for kakuhen; falling back to normal draw"
      );
      // フォールバックしておく
      return this.executeNormalDraw(prizes, results, request, member);
    }

    const selectedReserved =
      this.prizeDrawService.selectRandomReserved(reservedResults);

    const dummyWinnerPrize =
      this.prizeDrawService.pickRandomPrizeFrom(availablePrizes);
    const dummyWinnerPrizeId = dummyWinnerPrize?.id || null;

    const excludedIds = new Set(
      [selectedReserved.wonPrize?.id, dummyWinnerPrizeId].filter(Boolean)
    );
    const dummyPrizeIds = this.prizeDrawService.buildDummyPrizeIds(
      prizes,
      excludedIds,
      6
    );

    return {
      drawId: selectedReserved.drawId,
      winnerPrizeId: selectedReserved.wonPrize?.id || null,
      dummyWinnerPrizeId,
      dummyPrizeIds,
      isKakuhen: true,
    };
  }

  private async executeNormalDraw(
    prizes: Prize[],
    results: DrawResultDto[],
    request: DrawPrizeRequest,
    member: Member
  ): Promise<DrawPrizeResponse> {
    const availablePrizes = this.prizeDrawService.getAvailablePrizes(
      prizes,
      results
    );
    if (availablePrizes.length === 0) {
      console.warn("No available prizes left");
      return {
        drawId: this.idGenerator.nextId(),
        winnerPrizeId: null,
        dummyWinnerPrizeId: null,
        dummyPrizeIds: [],
      };
    }
    const result = this.prizeDrawService.drawPrize({
      prizes: availablePrizes,
      assignedPrizeIds: results
        .filter((r) => r.wonMember !== null)
        .map((r) => r.wonPrize?.id)
        .filter(Boolean) as string[],
      member: member as Member,
      dummyCount: Math.max(0, request.requestCount - 1),
    });
    return {
      drawId: this.idGenerator.nextId(),
      winnerPrizeId: result?.winnerPrizeId || null,
      dummyWinnerPrizeId: result?.dummyPrizeIds[0] || null,
      dummyPrizeIds: result?.dummyPrizeIds || [],
      isKakuhen: false,
    };
  }

  private async executeMemberDraw(
    request: DrawMemberRequest
  ): Promise<DrawMemberResponse> {
    const members = await this.memberRepo.getMembers();
    const results = await this.drawResultService.getDrawResults();

    const res = this.memberDrawService.drawMember(
      members,
      results,
      request.requestCount - 1
    );

    return {
      drawId: this.idGenerator.nextId(),
      winnerId: res?.winnerId ?? null,
      dummyIds: res?.dummyIds ?? [],
    };
  }

  private async saveDrawResult(
    prizeRes: DrawPrizeResponse,
    winnerMember: Member,
    winnerPrize: Prize,
    results: DrawResultDto[]
  ): Promise<DrawResultDto> {
    if (prizeRes.isKakuhen) {
      const existing = results.find((r) => r.drawId === prizeRes.drawId);
      if (!existing) {
        throw new NotFoundError("Reserved draw result not found");
      }
      const updated = mapToUpdatedDrawResult(existing, winnerMember, true);
      await this.drawResultService.updateDrawResult(updated);
      return updated;
    } else {
      const drawResult = mapToDrawResult(
        prizeRes.drawId,
        winnerMember,
        winnerPrize,
        false
      );
      await this.drawResultService.addDrawResult(drawResult);
      return drawResult;
    }
  }
}
