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
import type { Prize } from "../../domains/prize/prize";
import type { DrawResultDto } from "./dto/draw-result-dto";
import type { MemberDto } from "../member/dto/member-dto";
import { toMember } from "../member/dto/member-dto";

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
    const domainMembers = members.map(toMember);
    const results = await this.drawResultService.getDrawResults();

    const res = this.drawService.drawMember(
      domainMembers,
      results,
      request.requestCount - 1
    );

    return {
      drawId: crypto.randomUUID(),
      winnerId: res?.winnerId ?? null,
      dummyIds: res?.dummyIds ?? [],
    };
  }

  async executePrizeDraw(
    request: DrawPrizeRequest
  ): Promise<DrawPrizeResponse> {
    const members = await this.memberRepo.getMembers();
    const member = members.find((m) => m.id === request.memberId);
    if (!member)
      throw new Error("Member not found for prize draw: " + request.memberId);

    const state = await this.getPrizeDrawState();
    if (!state) throw new Error("Prize draw state not initialized");

    const results = await this.drawResultService.getDrawResults();
    const drawCount = results.filter((r) => r.wonMember !== null).length + 1;

    const prizes = await this.prizeRepo.getPrizes();

    if (state.kakuhenTimings.includes(drawCount)) {
      return this.executeKakuhenDraw(member, results, prizes);
    } else {
      return this.executeNormalDraw(prizes, results, state, request);
    }
  }

  async initializeStateIfNeeded(prizes: Prize[]): Promise<void> {
    if (await this.prizeDrawStateRepository.getState()) return;

    const newState = this.drawService.initializePrizeDrawState(prizes);
    await this.prizeDrawStateRepository.saveState(newState);
    await this.reservePrizes(newState, prizes);
  }

  private async getPrizeDrawState(): Promise<PrizeDrawState | null> {
    return await this.prizeDrawStateRepository.getState();
  }

  private async reservePrizes(
    state: PrizeDrawState,
    prizes: Prize[]
  ): Promise<void> {
    const reservedCount = state.kakuhenTimings.length;
    const sortedHigh = [...prizes].sort(
      (a, b) => (b.rank ?? 0) - (a.rank ?? 0)
    );
    const sortedLow = [...sortedHigh].reverse();
    const reservedPrizes: Prize[] = [];
    const isEven = reservedCount % 2 === 0;
    let useHigh = isEven ? true : Math.random() < 0.5;
    for (let i = 0; i < reservedCount; i++) {
      const source = useHigh ? sortedHigh : sortedLow;
      const candidate = source.find(
        (p) => !reservedPrizes.some((rp) => rp.id === p.id)
      );
      reservedPrizes.push(
        candidate || prizes[Math.floor(Math.random() * prizes.length)]
      );
      useHigh = !useHigh;
    }
    for (const prize of reservedPrizes) {
      await this.drawResultService.addDrawResult({
        drawId: `reserved-${prize.id}-${Date.now()}`,
        wonMember: null,
        wonPrize: prize,
        isKakuhen: false,
        createdAt: Date.now(),
      });
    }
  }

  private async executeKakuhenDraw(
    member: MemberDto,
    results: DrawResultDto[],
    prizes: Prize[]
  ): Promise<DrawPrizeResponse> {
    const availablePrizes = prizes.filter(
      (p) =>
        !results.some((r) => r.wonPrize?.id === p.id && r.wonMember !== null)
    );

    const reservedResults = results.filter((r) => r.wonMember === null);
    if (reservedResults.length === 0) {
      throw new Error("No reserved prizes available");
    }
    const selectedReserved =
      reservedResults[Math.floor(Math.random() * reservedResults.length)];

    // ダミーの当選景品をランダムに選ぶ
    const dummyWinnerPrize =
      availablePrizes[Math.floor(Math.random() * availablePrizes.length)];
    const dummyWinnerPrizeId = dummyWinnerPrize?.id || null;

    // ダミー景品を取得: 全景品から winnerPrizeId と dummyWinnerPrizeId を除いたものをランダムで取得
    const excludedIds = new Set(
      [selectedReserved.wonPrize?.id, dummyWinnerPrizeId].filter(Boolean)
    );
    const dummyCandidates = prizes.filter((p) => !excludedIds.has(p.id));
    const dummyPrizeIds = dummyCandidates
      .sort(() => Math.random() - 0.5) // ランダムシャッフル
      .slice(0, Math.max(0, 8 - 2)) // 例: ルーレット盤のサイズに応じて調整（ここでは8個の盤を想定し、2個を除く）
      .map((p) => p.id);

    await this.drawResultService.updateDrawResult({
      ...selectedReserved,
      wonMember: member,
      isKakuhen: true,
    });
    return {
      drawId: selectedReserved.drawId,
      winnerPrizeId: selectedReserved.wonPrize?.id || null,
      dummyWinnerPrizeId, // かくへん用のダミー当選景品ID
      dummyPrizeIds, // ルーレット盤を埋めるダミー景品ID
      isKakuhen: true,
    };
  }

  private async executeNormalDraw(
    prizes: Prize[],
    results: DrawResultDto[],
    state: PrizeDrawState,
    request: DrawPrizeRequest
  ): Promise<DrawPrizeResponse> {
    const availablePrizes = prizes.filter(
      (p) =>
        !results.some((r) => r.wonPrize?.id === p.id && r.wonMember !== null)
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
        rank: p.rank,
      })),
      requestDummyCount: Math.max(0, request.requestCount - 1),
      currentState: { kakuhenTimings: state.kakuhenTimings },
    });
    return {
      drawId: crypto.randomUUID(),
      winnerPrizeId: result.winnerPrizeId,
      dummyWinnerPrizeId: result.dummyPrizeIds[0] || null,
      dummyPrizeIds: result.dummyPrizeIds,
      isKakuhen: false,
    };
  }

  async getLastPrizeCount(): Promise<{ total: number; remaining: number }> {
    const prizes = await this.prizeRepo.getPrizes();
    const results = await this.drawResultService.getDrawResults();
    const assignedPrizeIds = new Set(
      results
        .filter((r) => r.wonMember !== null)
        .map((r) => r.wonPrize?.id)
        .filter(Boolean)
    );
    return {
      total: prizes.length,
      remaining: prizes.length - assignedPrizeIds.size,
    };
  }

  async executeDraw(request: {
    memberRequestCount: number;
    prizeRequestCount: number;
  }): Promise<DrawResultDto> {
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
      wonMember: winnerMember,
      wonPrize: winnerPrize,
      isKakuhen: prizeRes.isKakuhen ?? false,
      createdAt: Date.now(),
    };
    await this.drawResultService.addDrawResult(drawResult);

    return drawResult;
  }
}
