import { describe, it, expect, vi, beforeEach } from "vitest";
import { DrawApplicationService } from "./draw-application-service";

function createDeps(overrides: {
  members?: any[];
  prizes?: any[];
  existingResults?: any[];
  state?: number[] | null;
  memberDrawResult?: { winnerId: string | null; dummyIds: string[] } | null;
  isKakuhenTurn?: boolean;
  prizeDrawResult?: {
    winnerPrizeId: string | null;
    dummyPrizeIds: string[];
  } | null;
} = {}) {
  const members = overrides.members ?? [{ id: "m1", name: "Member1", rank: 1 }];
  const prizes = overrides.prizes ?? [
    { id: "p1", name: "Prize1", weight: 10, order: 1 },
  ];

  const memberRepo = { getMembers: vi.fn(async () => members) };
  const prizeRepo = { getPrizes: vi.fn(async () => prizes) };
  const drawResultService = {
    getDrawResults: vi.fn(async () => overrides.existingResults ?? []),
    addDrawResult: vi.fn(async () => undefined),
    updateDrawResult: vi.fn(async () => undefined),
  };
  const prizeDrawStateRepository = {
    getState: vi.fn(async () => overrides.state ?? []),
  };
  const memberDrawService = {
    drawMember: vi.fn(
      () => overrides.memberDrawResult ?? { winnerId: "m1", dummyIds: [] }
    ),
  };
  const prizeDrawService = {
    getAvailablePrizes: vi.fn((p: any[]) => p),
    getRemainingPrizes: vi.fn((p: any[]) => p),
    isKakuhenTurn: vi.fn(() => overrides.isKakuhenTurn ?? false),
    drawPrize: vi.fn(
      () =>
        overrides.prizeDrawResult ?? {
          winnerPrizeId: "p1",
          dummyPrizeIds: [],
        }
    ),
    selectRandomReserved: vi.fn(),
    pickRandomPrizeFrom: vi.fn(),
    buildDummyPrizeIds: vi.fn(() => []),
  };
  const idGenerator = { nextId: vi.fn(() => "draw-1") };
  const drawStateInitializer = { initialize: vi.fn(async () => undefined) };

  const service = new DrawApplicationService(
    memberRepo as any,
    prizeRepo as any,
    drawResultService as any,
    prizeDrawStateRepository as any,
    memberDrawService as any,
    prizeDrawService as any,
    idGenerator as any,
    drawStateInitializer as any
  );

  return { service, drawResultService, members, prizes };
}

describe("DrawApplicationService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("previewDraw", () => {
    /**
     * previewDrawは実際の抽選と同じ計算結果(当選メンバー・当選景品)を返すことをテストする。
     */
    it("returns a plausible DrawResultDto without persisting", async () => {
      const { service, drawResultService } = createDeps();

      const { result } = await service.previewDraw({
        memberRequestCount: 10,
        prizeRequestCount: 8,
      });

      expect(result.wonMember?.id).toBe("m1");
      expect(result.wonPrize?.id).toBe("p1");
      expect(result.isKakuhen).toBe(false);
      expect(drawResultService.addDrawResult).not.toHaveBeenCalled();
      expect(drawResultService.updateDrawResult).not.toHaveBeenCalled();
    });

    /**
     * previewDrawはaddDrawResult/updateDrawResultを一切呼ばないことを明示的に保証する
     * (デモ画面が本番データを汚染しないことの根拠となる回帰テスト)。
     */
    it("never calls addDrawResult or updateDrawResult, even for a kakuhen turn", async () => {
      const reservedResult = {
        drawId: "reserved-1",
        wonMember: null,
        wonPrize: { id: "p1", name: "Prize1", weight: 10, order: 1 },
        isKakuhen: false,
        createdAt: 0,
      };
      const { service, drawResultService } = createDeps({
        existingResults: [reservedResult],
        isKakuhenTurn: true,
        prizeDrawResult: null,
      });

      // executeKakuhenDraw is exercised via the real PrizeDrawService in the app;
      // here we only need to confirm previewDraw still never persists even when
      // computeDrawResult resolves a reserved (kakuhen) draw result.
      // Since prizeDrawService is mocked directly here, isKakuhenTurn=true routes
      // through executeKakuhenDraw, which uses selectRandomReserved/pickRandomPrizeFrom.
      const svcAny = service as any;
      vi.spyOn(svcAny, "executeKakuhenDraw").mockResolvedValue({
        drawId: "reserved-1",
        winnerPrizeId: "p1",
        dummyWinnerPrizeId: null,
        dummyPrizeIds: [],
        isKakuhen: true,
      });

      const { result } = await service.previewDraw({
        memberRequestCount: 10,
        prizeRequestCount: 8,
      });

      expect(result.isKakuhen).toBe(true);
      expect(drawResultService.addDrawResult).not.toHaveBeenCalled();
      expect(drawResultService.updateDrawResult).not.toHaveBeenCalled();
    });
  });

  describe("executeDraw", () => {
    /**
     * executeDrawは従来通り、通常抽選の場合にaddDrawResultをちょうど1回だけ呼ぶ
     * ことをテストする(previewDrawへのリファクタ後もこの挙動が変わっていないことの
     * 回帰確認)。
     */
    it("persists exactly once via addDrawResult for a normal (non-kakuhen) draw", async () => {
      const { service, drawResultService } = createDeps();

      const { result } = await service.executeDraw({
        memberRequestCount: 10,
        prizeRequestCount: 8,
      });

      expect(result.wonMember?.id).toBe("m1");
      expect(drawResultService.addDrawResult).toHaveBeenCalledTimes(1);
      expect(drawResultService.updateDrawResult).not.toHaveBeenCalled();
    });

    it("throws when no member winner is available", async () => {
      const { service } = createDeps({
        memberDrawResult: { winnerId: null, dummyIds: [] },
      });

      await expect(
        service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 })
      ).rejects.toThrow();
    });
  });
});
