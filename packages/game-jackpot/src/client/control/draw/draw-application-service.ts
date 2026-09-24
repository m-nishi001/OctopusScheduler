import { injectable, inject } from "tsyringe";
import { DrawResultService } from "./draw-result-service";
import { MemberDrawService } from "../../model/draw/member-draw-service";
import { PrizeDrawService } from "../../model/draw/prize-draw-service";
import type { DrawMemberRequest } from "./dto/draw-member-request";
import type { DrawMemberResponse } from "./dto/draw-member-response";
import type { DrawPrizeRequest } from "./dto/draw-prize-request";
import type { DrawPrizeResponse } from "./dto/draw-prize-response";
import {
  PrizeDrawStateRepository,
  type PrizeDrawState,
} from "../../model/draw/prize-draw-state-repository";
import type { Prize } from "../../model/prize/prize";
import type { DrawResultDto } from "./dto/draw-result-dto";
import type { Member } from "../../model/member/member";
import { CryptoIdGenerator } from "../../model/common/crypto-id-generator";
import {
  NotFoundError,
  StateNotInitializedError,
  NoAvailablePrizesError,
} from "../../model/errors";
import { DrawStateInitializer } from "./draw-state-initializer";
import {
  mapToDrawResult,
  mapToUpdatedDrawResult,
} from "./mappers/draw-result-mapper";
import { MemberRepository } from "../../model/member/member-repository";
import { PrizeRepository } from "../../model/prize/prize-repository";

@injectable()
export class DrawApplicationService {
  constructor(
    @inject(MemberRepository) private readonly memberRepo: MemberRepository,
    @inject(PrizeRepository) private readonly prizeRepo: PrizeRepository,
    @inject(DrawResultService) private drawResultService: DrawResultService,
    @inject(PrizeDrawStateRepository)
    private prizeDrawStateRepository: PrizeDrawStateRepository,
    @inject(MemberDrawService) private memberDrawService: MemberDrawService,
    @inject(PrizeDrawService) private prizeDrawService: PrizeDrawService,
    @inject(CryptoIdGenerator) private readonly idGenerator: CryptoIdGenerator,
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

  /**
   * 本番の抽選を実行し、結果を永続化する。
   */
  async executeDraw(request: {
    memberRequestCount: number;
    prizeRequestCount: number;
  }): Promise<{
    result: DrawResultDto;
    prizeRes: DrawPrizeResponse;
    memberRes: DrawMemberResponse;
  }> {
    const computed = await this.computeDrawResult(request);
    const saved = await this.saveDrawResult(
      computed.prizeRes,
      computed.winnerMember,
      computed.winnerPrize,
      computed.results
    );
    return {
      result: saved,
      prizeRes: computed.prizeRes,
      memberRes: computed.memberRes,
    };
  }

  /**
   * 本番と同じ抽選計算を行うが、結果を一切永続化しない(景品在庫・メンバー・抽選結果・
   * 抽選状態を汚染しない)プレビュー用抽選。デモ画面のリハーサルなど、本番データを
   * 消費せずに「実際の抽選と同じ見た目の結果」を確認したい用途に使う。
   */
  async previewDraw(request: {
    memberRequestCount: number;
    prizeRequestCount: number;
  }): Promise<{
    result: DrawResultDto;
    prizeRes: DrawPrizeResponse;
    memberRes: DrawMemberResponse;
  }> {
    const computed = await this.computeDrawResult(request);
    const result = this.buildDrawResult(
      computed.prizeRes,
      computed.winnerMember,
      computed.winnerPrize,
      computed.results
    );
    return { result, prizeRes: computed.prizeRes, memberRes: computed.memberRes };
  }

  /**
   * メンバー抽選〜確変判定〜景品抽選までの計算を行う(永続化は一切行わない)。
   * `executeDraw`(永続化あり)と `previewDraw`(永続化なし)の共通ロジック。
   */
  private async computeDrawResult(request: {
    memberRequestCount: number;
    prizeRequestCount: number;
  }): Promise<{
    prizeRes: DrawPrizeResponse;
    memberRes: DrawMemberResponse;
    winnerMember: Member;
    winnerPrize: Prize;
    results: DrawResultDto[];
  }> {
    const memberRes = await this.executeMemberDraw({
      requestCount: request.memberRequestCount,
    });
    console.log(
      "[DrawApplicationService] computeDrawResult: member draw response",
      memberRes
    );
    if (!memberRes.winnerId) {
      throw new NotFoundError("No member winner");
    }
    const members = await this.memberRepo.getMembers();
    const winnerMember = members.find((m) => m.id === memberRes.winnerId);
    console.log(
      "[DrawApplicationService] computeDrawResult: resolved winner member",
      { winnerId: memberRes.winnerId, winnerMember }
    );
    if (!winnerMember) throw new NotFoundError("Winner member not found");

    const prizes = await this.prizeRepo.getPrizes();
    const results = await this.drawResultService.getDrawResults();
    const state = await this.getPrizeDrawState();
    if (!state)
      throw new StateNotInitializedError("Prize draw state not initialized");
    const isKakuhen = this.prizeDrawService.isKakuhenTurn(
      prizes,
      results,
      state
    );
    console.log(
      "[DrawApplicationService] computeDrawResult: isKakuhen",
      isKakuhen,
      {
        totalPrizes: prizes.length,
        remainingPrizes: this.prizeDrawService.getRemainingPrizes(
          prizes,
          results
        ).length,
        state,
        resultCount: results.length,
      }
    );

    const prizeRequest = {
      memberId: winnerMember.id,
      requestCount: request.prizeRequestCount,
    };

    const prizeRes = await (isKakuhen
      ? this.executeKakuhenDraw(winnerMember, results, prizes, prizeRequest)
      : this.executeNormalDraw(prizes, results, prizeRequest, winnerMember));
    console.log(
      "[DrawApplicationService] computeDrawResult: prize response",
      prizeRes
    );

    if (!prizeRes.winnerPrizeId) {
      throw new NoAvailablePrizesError("No prize available");
    }

    const winnerPrize = prizes.find((p) => p.id === prizeRes.winnerPrizeId)!;

    return { prizeRes, memberRes, winnerMember, winnerPrize, results };
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
      dummyWinnerPrizeId: null,
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

  /**
   * 抽選結果DTOを組み立てる(永続化はしない)。
   */
  private buildDrawResult(
    prizeRes: DrawPrizeResponse,
    winnerMember: Member,
    winnerPrize: Prize,
    results: DrawResultDto[]
  ): DrawResultDto {
    if (prizeRes.isKakuhen) {
      const existing = results.find((r) => r.drawId === prizeRes.drawId);
      if (!existing) {
        throw new NotFoundError("Reserved draw result not found");
      }
      return mapToUpdatedDrawResult(existing, winnerMember, true);
    }
    return mapToDrawResult(prizeRes.drawId, winnerMember, winnerPrize, false);
  }

  private async saveDrawResult(
    prizeRes: DrawPrizeResponse,
    winnerMember: Member,
    winnerPrize: Prize,
    results: DrawResultDto[]
  ): Promise<DrawResultDto> {
    const drawResult = this.buildDrawResult(
      prizeRes,
      winnerMember,
      winnerPrize,
      results
    );
    if (prizeRes.isKakuhen) {
      console.log(
        "[DrawApplicationService] saveDrawResult: updating reserved",
        drawResult
      );
      await this.drawResultService.updateDrawResult(drawResult);
    } else {
      console.log(
        "[DrawApplicationService] saveDrawResult: adding new",
        drawResult
      );
      await this.drawResultService.addDrawResult(drawResult);
    }
    return drawResult;
  }
}
