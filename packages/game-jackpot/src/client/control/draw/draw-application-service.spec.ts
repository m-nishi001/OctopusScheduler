import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DrawApplicationService } from "./draw-application-service";
import { DrawStateInitializer } from "./draw-state-initializer";
import { RehearsalDrawStore } from "./rehearsal-draw-store";
import { MemberDrawService } from "../../model/draw/member-draw-service";
import { PrizeDrawService } from "../../model/draw/prize-draw-service";
import { PrizeReservationService } from "../../model/draw/prize-reservation-service";
import { WeightedSelector } from "../../model/draw/weighted-selector";
import { MathRandomProvider } from "../../model/common/math-random-provider";
import { DrawConflictError, NoEligibleMembersError } from "../../model/errors";
import type { DrawStore } from "./draw-store";

const roster = ["alice", "bob", "carol", "dave"].map((id, i) => ({ id, name: id, rank: i }));
const prizeList = Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, name: `Prize${i + 1}`, weight: 10, order: i + 1 }));

function setup(options: { members?: typeof roster; prizes?: typeof prizeList; eligibleMemberIds?: string[] | null; poolError?: Error; store?: DrawStore } = {}) {
  const members = options.members ?? roster;
  const prizes = options.prizes ?? prizeList;
  const rand = new MathRandomProvider();
  const selector = new WeightedSelector(rand);
  const memberDrawService = new MemberDrawService(selector, rand);
  const prizeDrawService = new PrizeDrawService(selector, rand);
  const store = options.store ?? new RehearsalDrawStore();
  let n = 0;
  const drawPool = {
    getEligibleMemberIds: vi.fn(async () => {
      if (options.poolError) throw options.poolError;
      return options.eligibleMemberIds ?? null;
    }),
  };
  const service = new DrawApplicationService(
    { getMembers: async () => members } as never,
    { getPrizes: async () => prizes } as never,
    { current: () => store },
    memberDrawService,
    prizeDrawService,
    { nextId: () => `draw-${++n}` } as never,
    new DrawStateInitializer(new PrizeReservationService(rand)),
    drawPool as never
  );
  return { service, store, memberDrawService, prizes, members };
}

const REQUEST = { memberRequestCount: 10, prizeRequestCount: 8 };

describe("DrawApplicationService", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  describe("previewDraw", () => {
    it("実際の抽選と同じ形の結果を返し、確定(commit)しない", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes);
      const commit = vi.spyOn(store, "commit");
      const { result } = await service.previewDraw(REQUEST);
      expect(result.wonMember).toBeTruthy();
      expect(result.wonPrize).toBeTruthy();
      expect(commit).not.toHaveBeenCalled();
      expect(await store.results()).toEqual([]);
    });
  });

  describe("executeDraw", () => {
    it("通常の抽選は、結果をちょうど1回 commit する(未公開のまま)", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      const commit = vi.spyOn(store, "commit");
      const { result, prizeRes } = await service.executeDraw(REQUEST);
      expect(commit).toHaveBeenCalledTimes(1);
      expect(prizeRes.isKakuhen).toBe(false);
      expect(await store.results()).toHaveLength(1);
      expect((await store.pending())?.drawId).toBe(result.drawId);
    });

    it("確変の回は、取り置いた景品を新しい drawId で commit する", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [2] });
      const plan = (await store.plan())!;
      expect(plan.kakuhenTimings).toEqual([2]);
      const first = await service.executeDraw(REQUEST);
      expect(first.result.isKakuhen).toBe(false);
      expect(plan.reservedPrizeIds).not.toContain(first.result.wonPrize!.id);
      const second = await service.executeDraw(REQUEST);
      expect(second.result.isKakuhen).toBe(true);
      expect(plan.reservedPrizeIds).toContain(second.result.wonPrize!.id);
      expect(second.result.drawId).not.toBe(first.result.drawId);
    });

    it("前の抽選が未公開のまま残っていれば、先に公開してから引く", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes);
      const first = await service.executeDraw(REQUEST);
      const reveal = vi.spyOn(store, "reveal");
      await service.executeDraw(REQUEST);
      expect(reveal).toHaveBeenCalledWith(first.result.drawId);
    });

    it("commit が矛盾(別の端末の操作など)で断られたら、1回だけ引き直す。2回続けば例外", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes);
      const commit = vi.spyOn(store, "commit").mockRejectedValueOnce(new DrawConflictError("このメンバーはすでに当選しています"));
      await expect(service.executeDraw(REQUEST)).resolves.toBeTruthy();
      expect(commit).toHaveBeenCalledTimes(2);

      vi.spyOn(store, "commit").mockRejectedValue(new DrawConflictError("矛盾"));
      await expect(service.executeDraw(REQUEST)).rejects.toThrow(DrawConflictError);
    });

    it("確変の予定が無ければ明示的な例外", async () => {
      const { service } = setup();
      await expect(service.executeDraw(REQUEST)).rejects.toThrow(/not initialized/);
    });

    it("同じ人・同じ景品は、何度抽選しても二度当たらない(確定済みの結果が正本)", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes);
      for (let i = 0; i < 4; i++) await service.executeDraw(REQUEST);
      const results = await store.results();
      expect(new Set(results.map((r) => r.wonMember!.id)).size).toBe(4);
      expect(new Set(results.map((r) => r.wonPrize!.id)).size).toBe(4);
      await expect(service.executeDraw(REQUEST)).rejects.toThrow();
    });
  });

  describe("resumeDraw", () => {
    it("引き直さず、確定済みの当選者・景品のまま、ダミーだけを作り直す", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      const { result } = await service.executeDraw(REQUEST);
      const pending = (await store.pending())!;
      const commit = vi.spyOn(store, "commit");
      const resumed = await service.resumeDraw(pending);
      expect(commit).not.toHaveBeenCalled();
      expect(resumed.result.drawId).toBe(result.drawId);
      expect(resumed.memberRes.winnerId).toBe(result.wonMember!.id);
      expect(resumed.prizeRes.winnerPrizeId).toBe(result.wonPrize!.id);
      expect(resumed.memberRes.dummyIds).not.toContain(result.wonMember!.id);
      expect(resumed.prizeRes.dummyPrizeIds).not.toContain(result.wonPrize!.id);
      expect(resumed.prizeRes.isKakuhen).toBe(false);
    });

    it("確変の抽選は、確変の演出の材料(ダミー当選)つきで作り直す", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [1] });
      const { result } = await service.executeDraw(REQUEST);
      const resumed = await service.resumeDraw((await store.pending())!);
      expect(resumed.result.isKakuhen).toBe(true);
      expect(resumed.prizeRes.isKakuhen).toBe(true);
      expect(resumed.prizeRes.winnerPrizeId).toBe(result.wonPrize!.id);
      expect(resumed.prizeRes.dummyWinnerPrizeId).toBeTruthy();
      expect(resumed.prizeRes.dummyWinnerPrizeId).not.toBe(result.wonPrize!.id);
    });

    it("当選者がメンバー名簿に見つからなければ、理由の分かる例外", async () => {
      const { service } = setup();
      await expect(
        service.resumeDraw({ drawId: "d", wonMember: { id: "ghost", name: "幽霊", rank: 1 }, wonPrize: prizeList[0], isKakuhen: false, createdAt: 1 })
      ).rejects.toThrow(/幽霊/);
    });
  });

  describe("getDrawProgress", () => {
    it("対象の人数(eligibleMembers)を含め、同じセッションの前のイベントの結果も数える", async () => {
      const { service, prizes } = setup({ eligibleMemberIds: ["alice", "bob", "carol"] });
      await service.initializeStateIfNeeded(prizes);
      for (let i = 0; i < 3; i++) await service.executeDraw(REQUEST);
      expect(await service.getDrawProgress()).toMatchObject({ endReason: "members", eligibleMembers: 3, remainingMembers: 0, drawn: 3 });
    });
  });

  describe("抽選の対象（エントリーした人だけ）", () => {
    const draw = (service: DrawApplicationService) => service.executeDraw(REQUEST);

    it("対象を指定しないときは、全メンバーを抽選に渡す", async () => {
      const { service, memberDrawService, prizes } = setup();
      await service.initializeStateIfNeeded(prizes);
      const spy = vi.spyOn(memberDrawService, "drawMember");
      await draw(service);
      expect((spy.mock.calls[0][0] as Array<{ id: string }>).map((m) => m.id)).toEqual(["alice", "bob", "carol", "dave"]);
    });

    it("対象に含まれるメンバーだけを候補にする。名簿に無いIDは無視する", async () => {
      const { service, memberDrawService, prizes } = setup({ eligibleMemberIds: ["bob", "dave", "stranger"] });
      await service.initializeStateIfNeeded(prizes);
      const spy = vi.spyOn(memberDrawService, "drawMember");
      const { result } = await draw(service);
      expect((spy.mock.calls[0][0] as Array<{ id: string }>).map((m) => m.id)).toEqual(["bob", "dave"]);
      expect(["bob", "dave"]).toContain(result.wonMember!.id);
    });

    it("対象が空・対象の全員が当選済みなら、人数の分かる理由の例外にする", async () => {
      const empty = setup({ eligibleMemberIds: [] });
      await empty.service.initializeStateIfNeeded(empty.prizes);
      await expect(draw(empty.service)).rejects.toThrow(NoEligibleMembersError);
      await expect(draw(empty.service)).rejects.toThrow(/対象のメンバーがいません/);

      const allWon = setup({ eligibleMemberIds: ["bob"] });
      await allWon.service.initializeStateIfNeeded(allWon.prizes);
      await draw(allWon.service);
      await expect(draw(allWon.service)).rejects.toThrow(/対象のメンバー\(1 名\)は、全員がすでに当選/);
    });

    it("対象の一覧を取得できないときは、そのまま例外を伝え、確定もしない", async () => {
      const { service, store, prizes } = setup({ poolError: new Error("エントリー者の一覧を取得できませんでした") });
      await service.initializeStateIfNeeded(prizes);
      await expect(draw(service)).rejects.toThrow("エントリー者の一覧を取得できませんでした");
      expect(await store.results()).toEqual([]);
    });
  });
});
