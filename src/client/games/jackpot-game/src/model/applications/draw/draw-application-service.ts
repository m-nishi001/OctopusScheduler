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

    if (res.winnerId) {
      const member = members.find((m) => m.id === res.winnerId)!;
      await this.drawResultService.addDrawResult({
        drawId: `member-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        member,
        prize: null,
        rank: null,
        order: 1,
        isWinner: true,
      });
    }

    return {
      drawId: `member-${Date.now()}`,
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
    const memberRank = member ? member.rank : 0;

    let state: PrizeDrawState | null =
      await this.prizeDrawStateRepository.getState();
    const availablePrizes = prizes.filter((p) => !p.isAssigned);

    if (!state) {
      state = this.drawService.initializePrizeDrawState(availablePrizes);
      // Mark reserved prizes
      await this.prizeRepo.updatePrizes(
        state.reservedPrizeIds.map((id) => ({
          id,
          updateFn: (p) => ({ ...p, isReserved: true }),
        }))
      );
      await this.prizeDrawStateRepository.saveState(state!);
    }

    // At this point, state is not null
    const currentState = state!;
    currentState.drawCount += 1;
    currentState.remaining = availablePrizes.length;
    await this.prizeDrawStateRepository.saveState(currentState);

    const result = this.drawService.executePrizeDraw({
      prizes: prizes.map((p) => ({
        id: p.id,
        weight: p.probability,
        rank: p.rank,
        isAssigned: p.isAssigned,
      })),
      memberRank,
      requestDummyCount: Math.max(0, request.requestCount - 1),
      currentState,
    });

    if (result.isKakuhen && result.winnerPrizeId) {
      await this.prizeRepo.updatePrizes([
        {
          id: result.winnerPrizeId,
          updateFn: (p) => ({ ...p, isAssigned: true, isReserved: false }),
        },
      ]);
      const drawId = `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await this.drawResultService.addDrawResult({
        drawId,
        member: member!,
        prize: (await this.prizeRepo.getPrizes()).find(
          (p) => p.id === result.winnerPrizeId
        ),
        rank: null,
        order: 1,
        isWinner: true,
      });

      currentState.remaining = (await this.prizeRepo.getPrizes()).filter(
        (p) => !p.isAssigned
      ).length;
      await this.prizeDrawStateRepository.saveState(currentState);

      return {
        drawId,
        winnerPrizeId: result.winnerPrizeId,
        dummyWinnerPrizeId: result.dummyPrizeIds[0] || null,
        dummyPrizeIds: result.dummyPrizeIds,
        isKakuhen: true,
        reservedPrizeIds: result.reservedPrizeIds,
      };
    } else if (result.winnerPrizeId) {
      await this.prizeRepo.updatePrizes([
        {
          id: result.winnerPrizeId,
          updateFn: (p) => ({ ...p, isAssigned: true }),
        },
      ]);

      const drawId = `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await this.drawResultService.addDrawResult({
        drawId,
        member: member!,
        prize: (await this.prizeRepo.getPrizes()).find(
          (p) => p.id === result.winnerPrizeId
        ),
        rank: null,
        order: 1,
        isWinner: true,
      });

      currentState.remaining = (await this.prizeRepo.getPrizes()).filter(
        (p) => !p.isAssigned
      ).length;
      await this.prizeDrawStateRepository.saveState(currentState);

      return {
        drawId,
        winnerPrizeId: result.winnerPrizeId,
        dummyWinnerPrizeId: result.dummyPrizeIds[0] || null,
        dummyPrizeIds: result.dummyPrizeIds,
      };
    } else {
      return {
        drawId: `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        winnerPrizeId: null,
        dummyWinnerPrizeId: result.dummyPrizeIds[0] || null,
        dummyPrizeIds: result.dummyPrizeIds,
      };
    }
  }

  async getLastPrizeCount(): Promise<{ total: number; remaining: number }> {
    const prizes = await this.prizeRepo.getPrizes();
    return {
      total: prizes.length,
      remaining: prizes.filter((p) => !p.isAssigned).length,
    };
  }

  async executeKakuhenAssign(): Promise<DrawPrizeResponse> {
    const state = await this.prizeDrawStateRepository.getState();
    if (!state || !state.reservedPrizeIds.length) {
      return {
        drawId: `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        winnerPrizeId: null,
        dummyWinnerPrizeId: null,
        dummyPrizeIds: [],
        isKakuhen: true,
        reservedPrizeIds: [],
      };
    }

    const result = this.drawService.executeKakuhenAssign({
      reservedPrizeIds: state.reservedPrizeIds,
    });

    if (result.winnerPrizeId) {
      await this.prizeRepo.updatePrizes([
        {
          id: result.winnerPrizeId,
          updateFn: (p) => ({ ...p, isAssigned: true, isReserved: false }),
        },
      ]);

      const drawId = `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await this.drawResultService.addDrawResult({
        drawId,
        member: null,
        prize: (await this.prizeRepo.getPrizes()).find(
          (p) => p.id === result.winnerPrizeId
        ),
        rank: null,
        order: 1,
        isWinner: true,
      });

      await this.prizeDrawStateRepository.saveState(state);
    }

    return {
      drawId: `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      winnerPrizeId: result.winnerPrizeId,
      dummyWinnerPrizeId: null,
      dummyPrizeIds: [],
      isKakuhen: true,
      reservedPrizeIds: result.reservedPrizeIds,
    };
  }
}
