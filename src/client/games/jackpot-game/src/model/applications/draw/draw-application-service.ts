import { injectable, container } from "tsyringe";
import { DrawService } from "../../domains/draw/draw-service";
import { MemberRepository } from "../../infrastructures/member-repository";
import { PrizeRepository } from "../../infrastructures/prize-repository";
import { DrawResultService } from "./draw-result-service";
import type { DrawMemberRequest } from "./dto/draw-member-request";
import type { DrawMemberResponse } from "./dto/draw-member-response";
import type { DrawPrizeRequest } from "./dto/draw-prize-request";
import type { DrawPrizeResponse } from "./dto/draw-prize-response";
import {
  PrizeDrawStateRepository,
  type PrizeDrawState,
} from "../../infrastructures/prize-draw-state-repository";
import type { DrawResultDto } from "./dto/draw-result-dto";

@injectable()
export class DrawApplicationService {
  private memberRepo: MemberRepository;
  private prizeRepo: PrizeRepository;
  private drawResultService: DrawResultService;
  private prizeDrawStateRepository: PrizeDrawStateRepository;
  private drawService: DrawService;

  constructor() {
    this.memberRepo = container.resolve(MemberRepository);
    this.prizeRepo = container.resolve(PrizeRepository);
    this.drawResultService = container.resolve(DrawResultService);
    this.prizeDrawStateRepository = container.resolve(PrizeDrawStateRepository);
    this.drawService = container.resolve(DrawService);
  }

  async executeMemberDraw(
    request: DrawMemberRequest
  ): Promise<DrawMemberResponse> {
    const members = await this.memberRepo.getMembers();
    const results = await this.drawResultService.getDrawResults();
    const wonSet = new Set(results.map((r) => r.member?.id));

    const domainMembers = members.map((m) => ({
      id: m.id,
      rank: m.rank,
      isWinner: wonSet.has(m.id),
    }));

    const res = this.drawService.drawMember({
      members: domainMembers,
      requestDummyCount: request.requestCount - 1,
    });

    return {
      drawId: crypto.randomUUID(),
      winnerId: res.winnerId,
      dummyIds: res.dummyIds,
    };
  }

  async executePrizeDraw(
    request: DrawPrizeRequest
  ): Promise<DrawPrizeResponse> {
    const prizes = await this.prizeRepo.getPrizes();
    const members = await this.memberRepo.getMembers();
    const member = members.find((m) => m.id === request.memberId);
    if (!member) {
      throw new Error("Member not found for prize draw: " + request.memberId);
    }
    const memberRank = member ? member.rank : 0;

    let state: PrizeDrawState | null =
      await this.prizeDrawStateRepository.getState();

    if (!state) {
      // Initialize state and add reserved prize records
      state = this.drawService.initializePrizeDrawState(prizes);
      await this.prizeDrawStateRepository.saveState(state);

      // Determine reserved prizes
      const sortedByRank = [...prizes].sort(
        (a, b) => (b.rank ?? 0) - (a.rank ?? 0)
      );
      const high = sortedByRank.slice(0, 2);
      const low = [...sortedByRank].reverse().slice(0, 2);
      const reservedPrizes = Array.from(new Set([...high, ...low]));

      // Add reserved records to DrawResult
      for (const prize of reservedPrizes) {
        await this.drawResultService.addDrawResult({
          drawId: `reserved-${prize.id}-${Date.now()}`,
          member: null,
          prize,
          prizeRank: prize.rank ?? null,
          memberRank: null,
          isWinner: false,
          isKakuhen: false,
          createdAt: Date.now(),
        });
      }
    }

    // Get draw count from DrawResult
    const results = await this.drawResultService.getDrawResults();
    const drawCount = results.filter((r) => r.member !== null).length + 1;

    if (state.kakuhenTimings.includes(drawCount)) {
      // Kakuhen draw: update reserved record
      const reservedResults = results.filter((r) => r.member === null);
      if (reservedResults.length === 0) {
        throw new Error("No reserved prizes available");
      }
      const selectedReserved =
        reservedResults[Math.floor(Math.random() * reservedResults.length)];

      // Update the record
      await this.drawResultService.updateDrawResult({
        ...selectedReserved,
        member,
        isWinner: true,
        isKakuhen: true,
      });

      return {
        drawId: selectedReserved.drawId,
        winnerPrizeId: selectedReserved.prize?.id || null,
        dummyWinnerPrizeId: null,
        dummyPrizeIds: [],
        isKakuhen: true,
      };
    } else {
      // Normal draw
      const availablePrizes = prizes.filter(
        (p) => !results.some((r) => r.prize?.id === p.id && r.member !== null)
      );
      if (availablePrizes.length === 0) {
        console.warn("No available prizes left");
        return {
          drawId: `prize-${Date.now()}`,
          winnerPrizeId: null,
          dummyWinnerPrizeId: null,
          dummyPrizeIds: [],
        };
      }

      const result = this.drawService.executePrizeDraw({
        prizes: availablePrizes.map((p) => ({
          id: p.id,
          weight: p.probability,
          rank: p.rank,
        })),
        memberRank,
        requestDummyCount: Math.max(0, request.requestCount - 1),
        currentState: { kakuhenTimings: state.kakuhenTimings },
      });

      if (result.winnerPrizeId) {
        return {
          drawId: crypto.randomUUID(),
          winnerPrizeId: result.winnerPrizeId,
          dummyWinnerPrizeId: result.dummyPrizeIds[0] || null,
          dummyPrizeIds: result.dummyPrizeIds,
          isKakuhen: false,
        };
      } else {
        return {
          drawId: crypto.randomUUID(),
          winnerPrizeId: null,
          dummyWinnerPrizeId: result.dummyPrizeIds[0] || null,
          dummyPrizeIds: result.dummyPrizeIds,
          isKakuhen: false,
        };
      }
    }
  }

  async getLastPrizeCount(): Promise<{ total: number; remaining: number }> {
    const prizes = await this.prizeRepo.getPrizes();
    const results = await this.drawResultService.getDrawResults();
    const assignedPrizeIds = new Set(
      results
        .filter((r) => r.member !== null)
        .map((r) => r.prize?.id)
        .filter(Boolean)
    );
    return {
      total: prizes.length,
      remaining: prizes.length - assignedPrizeIds.size,
    };
  }

  async executeKakuhenAssign(): Promise<DrawPrizeResponse> {
    // Kakuhen is handled in executePrizeDraw
    return {
      drawId: `kakuhen-${Date.now()}`,
      winnerPrizeId: null,
      dummyWinnerPrizeId: null,
      dummyPrizeIds: [],
      isKakuhen: true,
    };
  }

  async executeDraw(request: {
    memberRequestCount: number;
    prizeRequestCount: number;
  }): Promise<{
    drawResult: DrawResultDto;
    memberWinnerId: string;
    prizeWinnerId: string | null;
    isKakuhen: boolean;
  }> {
    // メンバー抽選
    const memberRes = await this.executeMemberDraw({
      requestCount: request.memberRequestCount,
    });
    if (!memberRes.winnerId) throw new Error("No member winner");
    const members = await this.memberRepo.getMembers();
    const winnerMember = members.find((m) => m.id === memberRes.winnerId);
    if (!winnerMember) throw new Error("Winner member not found");

    // 景品抽選
    const prizeRes = await this.executePrizeDraw({
      memberId: winnerMember.id,
      requestCount: request.prizeRequestCount,
    });

    // 統合レコード保存
    const prizes = await this.prizeRepo.getPrizes();
    const winnerPrize = prizeRes.winnerPrizeId
      ? prizes.find((p) => p.id === prizeRes.winnerPrizeId) || null
      : null;
    const drawResult: DrawResultDto = {
      drawId: crypto.randomUUID(),
      member: winnerMember,
      prize: winnerPrize,
      prizeRank: winnerPrize?.rank || null,
      memberRank: winnerMember.rank,
      isWinner: true,
      isKakuhen: prizeRes.isKakuhen ?? false,
      createdAt: Date.now(),
    };
    await this.drawResultService.addDrawResult(drawResult);

    return {
      drawResult,
      memberWinnerId: memberRes.winnerId,
      prizeWinnerId: prizeRes.winnerPrizeId,
      isKakuhen: prizeRes.isKakuhen ?? false,
    };
  }
}
