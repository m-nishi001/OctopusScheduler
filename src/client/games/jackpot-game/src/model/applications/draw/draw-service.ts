import { injectable, container } from "tsyringe";
import { DrawService as DomainDrawService } from "../../domains/draw/draw-service";
import { MemberRepository } from "../../infrastructures/member-repository";
import { PrizeRepository } from "../../infrastructures/prize-repository";
import { DrawResultService } from "../draw-result/draw-result-service";
import type { DrawMemberRequest } from "./dto/draw-member-request";
import type { DrawMemberResponse } from "./dto/draw-member-response";
import type { DrawPrizeRequest } from "./dto/draw-prize-request";
import type { DrawPrizeResponse } from "./dto/draw-prize-response";
import { PrizeDrawStateRepository } from "../../infrastructures/prize-draw-state-repository";

@injectable()
export class DrawService {
  constructor() {
    // resolve dependencies from container where available; fallback to direct instances
    this.memberRepo = container.resolve(MemberRepository);
    this.prizeRepo = container.resolve(PrizeRepository);
    this.resultService = container.resolve(DrawResultService);
    this.stateRepo = new PrizeDrawStateRepository();
  }

  private memberRepo: MemberRepository;
  private prizeRepo: PrizeRepository;
  private resultService: DrawResultService;
  private stateRepo: PrizeDrawStateRepository;

  async executeMemberDraw(
    request: DrawMemberRequest
  ): Promise<DrawMemberResponse> {
    const members = await this.memberRepo.getMembers();
    const results = await this.resultService.getDrawResults();
    const wonSet = new Set(results.map((r) => r.member?.id));

    const domain = new DomainDrawService();
    const domainMembers = members.map((m) => ({
      id: m.id,
      weight: (m as any).weight ?? 1,
      isWinner: wonSet.has(m.id),
    }));
    const res = domain.drawMember({
      members: domainMembers,
      requestDummyCount: request.requestCount - 1,
    });
    // persist a partial draw result (member winner selected). prize will be assigned later.
    const drawId =
      "member-" + Date.now() + "-" + Math.floor(Math.random() * 1000000);
    if (res.winnerId) {
      const member = members.find((m) => m.id === res.winnerId)!;
      await this.resultService.addDrawResult({
        drawId,
        member,
        prize: null,
        rank: null,
        order: 1,
        isWinner: true,
      });
    }
    return { drawId, winnerId: res.winnerId, dummyIds: res.dummyIds };
  }

  async executePrizeDraw(
    request: DrawPrizeRequest
  ): Promise<DrawPrizeResponse> {
    const prizes = await this.prizeRepo.getPrizes();
    const members = await this.memberRepo.getMembers();
    const member = members.find((m) => m.id === request.memberId);
    const memberRank = member ? ((member as any).rank ?? 0) : 0;

    // initialize state if needed
    let state = await this.stateRepo.getState();
    const availablePrizes = prizes.filter((p) => !p.isAssigned);
    if (!state) {
      const total = availablePrizes.length;
      state = {
        total,
        remaining: total,
        drawCount: 0,
        kakuhenTimings: [],
        reservedPrizeIds: [],
        initializedAt: new Date().toISOString(),
      };
      // compute kakuhen timings per spec
      const firstPossibleStart = 4;
      if (total >= firstPossibleStart) {
        const firstHalfEnd = Math.floor(total / 2);
        const firstRangeStart = Math.max(firstPossibleStart, 4);
        const firstRangeEnd = Math.max(firstRangeStart, firstHalfEnd);
        const secondRangeStart = Math.max(
          firstHalfEnd + 1,
          Math.floor(total / 2) + 1
        );
        const secondRangeEnd = Math.max(secondRangeStart, total - 1);

        const pickInRange = (s: number, e: number) => {
          if (s > e) return null;
          return Math.floor(Math.random() * (e - s + 1)) + s;
        };

        const t1 = pickInRange(firstRangeStart, firstRangeEnd);
        const t2 = pickInRange(secondRangeStart, secondRangeEnd);
        state.kakuhenTimings = [];
        if (t1) state.kakuhenTimings.push(t1);
        if (t2) state.kakuhenTimings.push(t2);
      }

      // reserve up to 2 highest-rank and 2 lowest-rank prizes
      const sortedByRank = [...availablePrizes].sort(
        (a, b) => (b.rank ?? 0) - (a.rank ?? 0)
      );
      const high = sortedByRank.slice(0, 2).map((p) => p.id);
      const low = [...sortedByRank]
        .reverse()
        .slice(0, 2)
        .map((p) => p.id);
      const reserved = Array.from(new Set([...high, ...low]));
      state.reservedPrizeIds = reserved;
      // mark these prizes as reserved in repo
      await this.prizeRepo.updatePrizes(
        reserved.map((id) => ({
          id,
          updateFn: (p) => ({ ...p, isReserved: true }),
        }))
      );

      await this.stateRepo.saveState(state);
    }

    // increment draw count
    state.drawCount += 1;
    state.remaining = availablePrizes.length; // re-evaluate
    await this.stateRepo.saveState(state);

    const domain = new DomainDrawService();

    // If kakuhen hits this draw
    if (state.kakuhenTimings.includes(state.drawCount)) {
      // First response: tell UI to perform kakuhen sequence (UI will call back for the second auto-draw)
      // produce dummy ids by running a domain draw (stateless) and taking its dummy ids
      const trial = domain.drawPrize({
        prizes: prizes.map((p) => ({
          id: p.id,
          weight: p.probability,
          rank: p.rank,
        })),
        memberRank,
        requestDummyCount: Math.max(0, request.requestCount - 1),
      });
      return {
        drawId:
          "prize-" + Date.now() + "-" + Math.floor(Math.random() * 1000000),
        winnerPrizeId: null,
        dummyPrizeIds: trial.dummyPrizeIds,
        isKakuhen: true,
        reservedPrizeIds: state.reservedPrizeIds,
      };
    }

    // Normal draw: pick prize based on member rank
    const domainPrizes = prizes.map((p) => ({
      id: p.id,
      weight: p.probability,
      rank: p.rank,
      isReserved: p.isReserved,
      isAssigned: p.isAssigned,
    }));
    const pick = domain.drawPrize({
      prizes: domainPrizes,
      memberRank,
      requestDummyCount: Math.max(0, request.requestCount - 1),
    });
    if (!pick.winnerPrizeId) {
      return {
        drawId:
          "prize-" + Date.now() + "-" + Math.floor(Math.random() * 1000000),
        winnerPrizeId: null,
        dummyPrizeIds: pick.dummyPrizeIds,
      };
    }

    // assign prize (clear reserved flag if set)
    await this.prizeRepo.updatePrizes([
      {
        id: pick.winnerPrizeId,
        updateFn: (p) => ({ ...p, isAssigned: true, isReserved: false }),
      },
    ]);

    // associate with latest member draw result (simplified: find last draw result without prize for this member)
    const results = await this.resultService.getDrawResults();
    const pending = results
      .reverse()
      .find(
        (r) =>
          r.member &&
          r.member.id === request.memberId &&
          (!r.prize || r.prize === null)
      );
    if (pending) {
      pending.prize = prizes.find((pr) => pr.id === pick.winnerPrizeId) || null;
      await this.resultService.updateDrawResult(pending);
    } else {
      // fallback: create a draw result
      const members = await this.memberRepo.getMembers();
      const memberObj = members.find((m) => m.id === request.memberId)!;
      await this.resultService.addDrawResult({
        drawId:
          "prize-" + Date.now() + "-" + Math.floor(Math.random() * 1000000),
        member: memberObj,
        prize: prizes.find((pr) => pr.id === pick.winnerPrizeId) || null,
        rank: null,
        order: 1,
        isWinner: true,
      });
    }

    // update state remaining
    state.remaining = (await this.prizeRepo.getPrizes()).filter(
      (p) => !p.isAssigned
    ).length;
    await this.stateRepo.saveState(state);

    return {
      drawId: "prize-" + Date.now() + "-" + Math.floor(Math.random() * 1000000),
      winnerPrizeId: pick.winnerPrizeId,
      dummyPrizeIds: pick.dummyPrizeIds,
    };
  }

  async getLastPrizeCount(): Promise<{ total: number; remaining: number }> {
    const prizes = await this.prizeRepo.getPrizes();
    const total = prizes.length;
    const remaining = prizes.filter((p) => !p.isAssigned).length;
    return { total, remaining };
  }

  /**
   * When kakuhen triggers, assign one of the reserved prizes to the given member.
   */
  async executeKakuhenAssign(memberId: string): Promise<DrawPrizeResponse> {
    const state = await this.stateRepo.getState();
    if (
      !state ||
      !state.reservedPrizeIds ||
      state.reservedPrizeIds.length === 0
    ) {
      return {
        drawId:
          "prize-" + Date.now() + "-" + Math.floor(Math.random() * 1000000),
        winnerPrizeId: null,
        dummyPrizeIds: [],
        isKakuhen: true,
        reservedPrizeIds: [],
      };
    }
    // take one reserved prize (pop)
    const prizeId = state.reservedPrizeIds.shift()!;
    // mark assigned and clear reserved flag
    await this.prizeRepo.updatePrizes([
      {
        id: prizeId,
        updateFn: (p) => ({ ...p, isAssigned: true, isReserved: false }),
      },
    ]);

    // associate with pending member draw
    const prizes = await this.prizeRepo.getPrizes();
    const prizeObj = prizes.find((p) => p.id === prizeId) || null;
    const results = await this.resultService.getDrawResults();
    const pending = results
      .reverse()
      .find(
        (r) =>
          r.member && r.member.id === memberId && (!r.prize || r.prize === null)
      );
    if (pending) {
      pending.prize = prizeObj || null;
      await this.resultService.updateDrawResult(pending);
    } else {
      const members = await this.memberRepo.getMembers();
      const memberObj = members.find((m) => m.id === memberId)!;
      await this.resultService.addDrawResult({
        drawId:
          "prize-" + Date.now() + "-" + Math.floor(Math.random() * 1000000),
        member: memberObj,
        prize: prizeObj || null,
        rank: null,
        order: 1,
        isWinner: true,
      });
    }

    // save updated state
    await this.stateRepo.saveState(state);

    return {
      drawId: "prize-" + Date.now() + "-" + Math.floor(Math.random() * 1000000),
      winnerPrizeId: prizeId,
      dummyPrizeIds: [],
      isKakuhen: true,
      reservedPrizeIds: state.reservedPrizeIds,
    };
  }
}
