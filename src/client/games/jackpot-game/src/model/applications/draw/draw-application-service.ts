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
  }): Promise<{
    result: DrawResultDto;
    prizeRes: DrawPrizeResponse;
    memberRes: DrawMemberResponse;
  }> {
    const memberRes = await this.executeMemberDraw({
      requestCount: request.memberRequestCount,
    });
    console.log(
      "[DrawApplicationService] executeDraw: member draw response",
      memberRes
    );
    if (!memberRes.winnerId) {
      throw new NotFoundError("No member winner");
    }
    const members = await this.memberRepo.getMembers();
    const winnerMember = members.find((m) => m.id === memberRes.winnerId);
    console.log(
      "[DrawApplicationService] executeDraw: resolved winner member",
      { winnerId: memberRes.winnerId, winnerMember }
    );
    if (!winnerMember) throw new NotFoundError("Winner member not found");

    const prizes = await this.prizeRepo.getPrizes();
    const results = await this.drawResultService.getDrawResults();
    const state = await this.getPrizeDrawState();
    if (!state)
      throw new StateNotInitializedError("Prize draw state not initialized");
    // NOTE: kakuhen selection is forced true in some builds for demo; log decision
    // and related state for diagnostics.
    const isKakuhen = this.prizeDrawService.isKakuhenTurn(
      prizes,
      results,
      state
    );
    console.log("[DrawApplicationService] executeDraw: isKakuhen", isKakuhen);
    // const isKakuhen = true;
    console.log("[DrawApplicationService] executeDraw: kakuhen forced", {
      isKakuhen,
      totalPrizes: prizes.length,
      remainingPrizes: this.prizeDrawService.getRemainingPrizes(prizes, results)
        .length,
      state,
      resultCount: results.length,
    });

    const prizeRequest = {
      memberId: winnerMember.id,
      requestCount: request.prizeRequestCount,
    };

    const prizeRes = await (isKakuhen
      ? this.executeKakuhenDraw(winnerMember, results, prizes, prizeRequest)
      : this.executeNormalDraw(prizes, results, prizeRequest, winnerMember));
    console.log(
      "[DrawApplicationService] executeDraw: prize response",
      prizeRes
    );

    if (!prizeRes.winnerPrizeId) {
      throw new NoAvailablePrizesError("No prize available");
    }

    const winnerPrize = prizes.find((p) => p.id === prizeRes.winnerPrizeId)!;
    const saved = await this.saveDrawResult(
      prizeRes,
      winnerMember,
      winnerPrize,
      results
    );
    return { result: saved, prizeRes, memberRes };
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

    console.log("[DrawApplicationService] executeKakuhenDraw: diagnostics", {
      availableCount: availablePrizes.length,
      reservedCount: reservedResults.length,
      request,
      memberId: member.id,
    });

    if (reservedResults.length === 0) {
      console.warn(
        "DrawApplicationService: No reserved prizes available for kakuhen; falling back to normal draw"
      );
      // フォールバックしておく
      return this.executeNormalDraw(prizes, results, request, member);
    }

    const selectedReserved =
      this.prizeDrawService.selectRandomReserved(reservedResults);
    console.log(
      "[DrawApplicationService] executeKakuhenDraw: selectedReserved",
      selectedReserved
    );

    const dummyWinnerPrize =
      this.prizeDrawService.pickRandomPrizeFrom(availablePrizes);
    const dummyWinnerPrizeId = dummyWinnerPrize?.id || null;

    console.log(
      "[DrawApplicationService] executeKakuhenDraw: dummyWinnerPrizeId",
      {
        dummyWinnerPrizeId,
      }
    );

    const excludedIds = new Set(
      [selectedReserved.wonPrize?.id, dummyWinnerPrizeId].filter(Boolean)
    );
    const dummyPrizeIds = this.prizeDrawService.buildDummyPrizeIds(
      prizes,
      excludedIds,
      6
    );
    console.log(
      "[DrawApplicationService] executeKakuhenDraw: dummyPrizeIds",
      dummyPrizeIds
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
    console.log(
      "[DrawApplicationService] executeNormalDraw: availablePrizes",
      availablePrizes
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
    console.log(
      "[DrawApplicationService] executeNormalDraw: draw result",
      result,
      {
        memberId: member.id,
        requestCount: request.requestCount,
      }
    );
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

    const response = {
      drawId: this.idGenerator.nextId(),
      winnerId: res?.winnerId ?? null,
      dummyIds: res?.dummyIds ?? [],
    };
    console.log(
      "[DrawApplicationService] executeMemberDraw: response",
      response,
      { membersCount: members.length, existingResultsCount: results.length }
    );
    return response;
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
      console.log(
        "[DrawApplicationService] saveDrawResult: updating reserved",
        updated
      );
      await this.drawResultService.updateDrawResult(updated);
      return updated;
    } else {
      const drawResult = mapToDrawResult(
        prizeRes.drawId,
        winnerMember,
        winnerPrize,
        false
      );
      console.log(
        "[DrawApplicationService] saveDrawResult: adding new",
        drawResult
      );
      await this.drawResultService.addDrawResult(drawResult);
      return drawResult;
    }
  }
}
