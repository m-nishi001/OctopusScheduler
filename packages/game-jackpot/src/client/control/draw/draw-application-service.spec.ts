import { describe, it, expect, vi, beforeEach } from "vitest";
import { DrawApplicationService } from "./draw-application-service";
import { MemberDrawService } from "../../model/draw/member-draw-service";
import { WeightedSelector } from "../../model/draw/weighted-selector";
import { NoEligibleMembersError } from "../../model/errors";

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
  /** 抽選の対象。null / 省略は全メンバー。 */
  eligibleMemberIds?: string[] | null;
  poolError?: Error;
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
    getDrawablePrizes: vi.fn((p: any[]) => p),
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

  const drawPool = {
    getEligibleMemberIds: vi.fn(async () => {
      if (overrides.poolError) throw overrides.poolError;
      return overrides.eligibleMemberIds ?? null;
    }),
  };

  const service = new DrawApplicationService(
    memberRepo as any,
    prizeRepo as any,
    drawResultService as any,
    prizeDrawStateRepository as any,
    memberDrawService as any,
    prizeDrawService as any,
    idGenerator as any,
    drawStateInitializer as any,
    drawPool as any
  );

  return { service, drawResultService, members, prizes, memberDrawService, drawPool };
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

  describe("抽選の対象（エントリーした人だけ）", () => {
    const roster = ["alice", "bob", "carol", "dave"].map((id, i) => ({ id, name: id, rank: i }));
    const draw = (service: DrawApplicationService) => service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });

    it("対象を指定しないときは、全メンバーを抽選に渡す（従来どおり）", async () => {
      const { service, memberDrawService } = createDeps({ members: roster, memberDrawResult: { winnerId: "alice", dummyIds: [] } });
      await draw(service);
      const passed = (memberDrawService.drawMember.mock.calls[0] as unknown[])[0] as Array<{ id: string }>;
      expect(passed.map((m) => m.id)).toEqual(["alice", "bob", "carol", "dave"]);
    });

    it("対象に含まれるメンバーだけを、候補にもリールのダミーにも渡す", async () => {
      const { service, memberDrawService } = createDeps({
        members: roster,
        eligibleMemberIds: ["bob", "dave"],
        memberDrawResult: { winnerId: "bob", dummyIds: ["dave"] },
      });
      await draw(service);
      const passed = (memberDrawService.drawMember.mock.calls[0] as unknown[])[0] as Array<{ id: string }>;
      expect(passed.map((m) => m.id)).toEqual(["bob", "dave"]);
    });

    it("名簿に無いID（ジャックポットに登録の無い人）は無視する", async () => {
      const { service, memberDrawService } = createDeps({
        members: roster,
        eligibleMemberIds: ["bob", "stranger"],
        memberDrawResult: { winnerId: "bob", dummyIds: [] },
      });
      await draw(service);
      expect(((memberDrawService.drawMember.mock.calls[0] as unknown[])[0] as Array<{ id: string }>).map((m) => m.id)).toEqual(["bob"]);
    });

    it("対象が空・対象の全員が当選済みなら、理由の分かる例外にする（全メンバーにフォールバックしない）", async () => {
      const empty = createDeps({ members: roster, eligibleMemberIds: [] });
      await expect(draw(empty.service)).rejects.toThrow(NoEligibleMembersError);
      await expect(draw(empty.service)).rejects.toThrow(/対象のメンバーがいません/);
      expect(empty.memberDrawService.drawMember).not.toHaveBeenCalled();

      const allWon = createDeps({
        members: roster,
        eligibleMemberIds: ["bob"],
        existingResults: [{ wonMember: { id: "bob" }, wonPrize: { id: "p0" } }],
      });
      await expect(draw(allWon.service)).rejects.toThrow(/全員がすでに当選/);
      expect(allWon.memberDrawService.drawMember).not.toHaveBeenCalled();
    });

    it("対象の一覧を取得できないときは、そのまま例外を伝え、抽選も保存もしない", async () => {
      const { service, drawResultService, memberDrawService } = createDeps({ members: roster, poolError: new Error("エントリー者の一覧を取得できませんでした") });
      await expect(draw(service)).rejects.toThrow("エントリー者の一覧を取得できませんでした");
      expect(memberDrawService.drawMember).not.toHaveBeenCalled();
      expect(drawResultService.addDrawResult).not.toHaveBeenCalled();
    });

    it("プレビュー抽選にも同じ対象が使われる", async () => {
      const { service, memberDrawService } = createDeps({ members: roster, eligibleMemberIds: ["carol"], memberDrawResult: { winnerId: "carol", dummyIds: [] } });
      await service.previewDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
      expect(((memberDrawService.drawMember.mock.calls[0] as unknown[])[0] as Array<{ id: string }>).map((m) => m.id)).toEqual(["carol"]);
    });

    it("本物の抽選ロジックでも、対象外の人は決して当選せず、ダミーにも出ない", async () => {
      const real = new MemberDrawService(new WeightedSelector({ nextFloat: () => Math.random(), nextInt: (n: number) => Math.floor(Math.random() * n) } as any), {
        nextInt: (n: number) => Math.floor(Math.random() * n),
      } as any);
      const { service } = createDeps({ members: roster, eligibleMemberIds: ["bob", "carol"] });
      (service as any).memberDrawService = real;
      for (let i = 0; i < 100; i++) {
        const res = await (service as any).executeMemberDraw({ requestCount: 10 });
        expect(["bob", "carol"]).toContain(res.winnerId);
        for (const id of res.dummyIds) expect(["bob", "carol"]).toContain(id);
      }
    });
  });
});
