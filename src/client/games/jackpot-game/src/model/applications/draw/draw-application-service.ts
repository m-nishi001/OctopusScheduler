import { injectable, container } from "tsyringe";
import { DrawService } from "../../domains/draw/draw-service";
import { MemberRepository } from "../../infrastructures/member-repository";
import { PrizeRepository } from "../../infrastructures/prize-repository";
import { DrawResultService } from "../draw-result/draw-result-service";
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
      weight: (m as any).rank || 1,
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
    const memberRank = member ? ((member as any).rank ?? 0) : 0;

    let state: PrizeDrawState | null =
      await this.prizeDrawStateRepository.getState();
    const availablePrizes = prizes.filter((p) => !p.isAssigned);

    if (!state) {
      state = this.initializeState(availablePrizes);
      await this.prizeDrawStateRepository.saveState(state!);
    }

    // At this point, state is not null
    const currentState = state!;
    currentState.drawCount += 1;
    currentState.remaining = availablePrizes.length;
    await this.prizeDrawStateRepository.saveState(currentState);

    if (currentState.kakuhenTimings.includes(currentState.drawCount)) {
      // Kakuhen: return dummy ids for UI to perform re-draw
      const trial = this.drawService.drawPrize({
        prizes: prizes.map((p) => ({
          id: p.id,
          weight: p.probability,
          rank: p.rank,
        })),
        memberRank,
        requestDummyCount: Math.max(0, request.requestCount - 1),
      });
      return {
        drawId: `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        winnerPrizeId: null,
        dummyPrizeIds: trial.dummyPrizeIds,
        isKakuhen: true,
        reservedPrizeIds: currentState.reservedPrizeIds,
      };
    }

    // Normal draw
    const domainPrizes = prizes.map((p) => ({
      id: p.id,
      weight: p.probability,
      rank: p.rank,
      isAssigned: p.isAssigned,
    }));
    const pick = this.drawService.drawPrize({
      prizes: domainPrizes,
      memberRank,
      requestDummyCount: Math.max(0, request.requestCount - 1),
    });

    if (!pick.winnerPrizeId) {
      return {
        drawId: `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        winnerPrizeId: null,
        dummyPrizeIds: pick.dummyPrizeIds,
      };
    }

    await this.prizeRepo.updatePrizes([
      { id: pick.winnerPrizeId, updateFn: (p) => ({ ...p, isAssigned: true }) },
    ]);

    this.associatePrizeWithMember(request.memberId, pick.winnerPrizeId);

    currentState.remaining = (await this.prizeRepo.getPrizes()).filter(
      (p) => !p.isAssigned
    ).length;
    await this.prizeDrawStateRepository.saveState(currentState);

    return {
      drawId: `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      winnerPrizeId: pick.winnerPrizeId,
      dummyPrizeIds: pick.dummyPrizeIds,
    };
  }

  private initializeState(availablePrizes: any[]): any {
    const total = availablePrizes.length;
    const sortedByRank = [...availablePrizes].sort(
      (a, b) => (b.rank ?? 0) - (a.rank ?? 0)
    );
    const high = sortedByRank.slice(0, 2).map((p) => p.id);
    const low = [...sortedByRank]
      .reverse()
      .slice(0, 2)
      .map((p) => p.id);
    const reserved = Array.from(new Set([...high, ...low]));

    // Mark reserved
    this.prizeRepo.updatePrizes(
      reserved.map((id) => ({
        id,
        updateFn: (p) => ({ ...p, isReserved: true }),
      }))
    );

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
    const timings = [t1, t2].filter(Boolean);

    return {
      total,
      remaining: total,
      drawCount: 0,
      kakuhenTimings: timings,
      reservedPrizeIds: reserved,
      initializedAt: new Date().toISOString(),
    };
  }

  private async associatePrizeWithMember(memberId: string, prizeId: string) {
    const prizes = await this.prizeRepo.getPrizes();
    const prize = prizes.find((p) => p.id === prizeId);
    const results = await this.drawResultService.getDrawResults();
    const pending = results
      .reverse()
      .find((r) => r.member && r.member.id === memberId && !r.prize);
    if (pending) {
      pending.prize = prize || null;
      await this.drawResultService.updateDrawResult(pending);
    } else {
      const members = await this.memberRepo.getMembers();
      const member = members.find((m) => m.id === memberId)!;
      await this.drawResultService.addDrawResult({
        drawId: `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        member,
        prize: prize || null,
        rank: null,
        order: 1,
        isWinner: true,
      });
    }
  }

  async getLastPrizeCount(): Promise<{ total: number; remaining: number }> {
    const prizes = await this.prizeRepo.getPrizes();
    return {
      total: prizes.length,
      remaining: prizes.filter((p) => !p.isAssigned).length,
    };
  }

  async executeKakuhenAssign(memberId: string): Promise<DrawPrizeResponse> {
    const state = await this.prizeDrawStateRepository.getState();
    if (!state || !state.reservedPrizeIds.length) {
      return {
        drawId: `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        winnerPrizeId: null,
        dummyPrizeIds: [],
        isKakuhen: true,
        reservedPrizeIds: [],
      };
    }

    const prizeId = state.reservedPrizeIds.shift()!;
    await this.prizeRepo.updatePrizes([
      {
        id: prizeId,
        updateFn: (p) => ({ ...p, isAssigned: true, isReserved: false }),
      },
    ]);

    this.associatePrizeWithMember(memberId, prizeId);

    await this.prizeDrawStateRepository.saveState(state);

    return {
      drawId: `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      winnerPrizeId: prizeId,
      dummyPrizeIds: [],
      isKakuhen: true,
      reservedPrizeIds: state.reservedPrizeIds,
    };
  }
}
