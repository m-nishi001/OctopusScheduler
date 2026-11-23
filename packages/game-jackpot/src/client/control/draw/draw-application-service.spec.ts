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

const roster = ["alice", "bob", "carol", "dave"].map((id) => ({ id, name: id }));
const prizeList = Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, name: `Prize${i + 1}`, rank: 3, order: i + 1, kakuhen: i < 2 }));

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
  const memberRepo = { getMembers: vi.fn(async () => members) };
  const service = new DrawApplicationService(
    memberRepo as never,
    { getPrizes: async () => prizes } as never,
    { current: () => store },
    memberDrawService,
    prizeDrawService,
    { nextId: () => `draw-${++n}` } as never,
    new DrawStateInitializer(new PrizeReservationService(rand)),
    drawPool as never
  );
  return { service, store, memberDrawService, prizes, members, memberRepo };
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

  describe("drawNext(終了の判定と抽選を、対象の一覧の取得1回で行う)", () => {
    it("抽選できるときは、対象の一覧を1回だけ取得し、抽選して確定する", async () => {
      const eligibleMemberIds = ["alice", "bob"];
      const { service, store, prizes } = setup({ eligibleMemberIds });
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      const pool = (service as never as { drawPool: { getEligibleMemberIds: ReturnType<typeof vi.fn> } }).drawPool;
      const next = await service.drawNext(REQUEST);
      expect(next.kind).toBe("drawn");
      expect(pool.getEligibleMemberIds).toHaveBeenCalledTimes(1);
      if (next.kind === "drawn") expect(eligibleMemberIds).toContain(next.outcome.result.wonMember?.id);
      expect(await store.results()).toHaveLength(1);
    });

    it("対象が全員当選済みなら、抽選せずに終了(members)を返す。確定も増えない", async () => {
      const { service, store, prizes } = setup({ eligibleMemberIds: ["alice"] });
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      await service.drawNext(REQUEST);
      const commit = vi.spyOn(store, "commit");
      const next = await service.drawNext(REQUEST);
      expect(next).toMatchObject({ kind: "finished", progress: { endReason: "members" } });
      expect(commit).not.toHaveBeenCalled();
    });

    it("景品が尽きたら終了(prizes)を返す", async () => {
      const { service, prizes } = setup({ prizes: prizeList.slice(0, 1) });
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      await service.drawNext(REQUEST);
      expect(await service.drawNext(REQUEST)).toMatchObject({ kind: "finished", progress: { endReason: "prizes" } });
    });

    it("対象の一覧を取得できないときは、終了と見なさず例外のまま伝える", async () => {
      const { service, prizes } = setup({ poolError: new Error("offline") });
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      await expect(service.drawNext(REQUEST)).rejects.toThrow("offline");
    });
  });

  describe("対象の一覧・メンバー名簿の取得回数", () => {
    it("executeDraw は、入力を渡さなければ1回ずつ取得し、渡せば取得しない(1回の抽選で重ねて取得しない)", async () => {
      const { service, prizes, members, memberRepo } = setup({ eligibleMemberIds: ["alice", "bob"] });
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      const pool = (service as never as { drawPool: { getEligibleMemberIds: ReturnType<typeof vi.fn> } }).drawPool;
      await service.executeDraw(REQUEST);
      expect(pool.getEligibleMemberIds).toHaveBeenCalledTimes(1);
      expect(memberRepo.getMembers).toHaveBeenCalledTimes(1);
      await service.executeDraw(REQUEST, { eligibleIds: ["alice", "bob", "carol"], members });
      expect(pool.getEligibleMemberIds).toHaveBeenCalledTimes(1);
      expect(memberRepo.getMembers).toHaveBeenCalledTimes(1);
    });

    it("null(絞り込みなし)を渡したときも取得しない", async () => {
      const { service, prizes, members, memberRepo } = setup();
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      const pool = (service as never as { drawPool: { getEligibleMemberIds: ReturnType<typeof vi.fn> } }).drawPool;
      await service.executeDraw(REQUEST, { eligibleIds: null, members });
      expect(pool.getEligibleMemberIds).not.toHaveBeenCalled();
      expect(memberRepo.getMembers).not.toHaveBeenCalled();
    });

    it("drawNext は、対象の一覧もメンバー名簿も1回ずつ(終了の判定と抽選で共有)", async () => {
      const { service, prizes, memberRepo } = setup({ eligibleMemberIds: ["alice", "bob"] });
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      await service.drawNext(REQUEST);
      expect(memberRepo.getMembers).toHaveBeenCalledTimes(1);
    });
  });

  describe("prizeCounts(「あと半分」の判定の材料)", () => {
    it("当選対象でない景品は、全体にも残りにも数えない。確定した時点の数で、前後(before = after + 1)を返す", async () => {
      const prizes = [...prizeList, { id: "pX", name: "対象外", rank: 3, order: 7, kakuhen: false, drawable: false }];
      const { service } = setup({ prizes, members: ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, name: id })) });
      await service.initializeStateIfNeeded(prizes);
      const counts = [];
      for (let i = 0; i < 6; i++) {
        const next = await service.drawNext(REQUEST);
        if (next.kind !== "drawn") throw new Error("finished");
        counts.push(next.outcome.prizeCounts);
      }
      expect(counts.map((c) => c.total)).toEqual([6, 6, 6, 6, 6, 6]);
      expect(counts.map((c) => [c.before, c.after])).toEqual([[6, 5], [5, 4], [4, 3], [3, 2], [2, 1], [1, 0]]);
    });

    it("再開(resumeDraw)でも、先に次の抽選が確定していない限り、確定時点と同じ数になる", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes);
      const next = await service.drawNext(REQUEST);
      if (next.kind !== "drawn") throw new Error("finished");
      const pending = (await store.unrevealed())[0];
      const resumed = await service.resumeDraw(pending);
      expect(resumed.prizeCounts).toEqual(next.outcome.prizeCounts);
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
      expect((await store.unrevealed())[0]?.drawId).toBe(result.drawId);
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

    it("前の抽選が未公開のままでも公開せずに次を確定する(演出中に先読みするため)。未公開は古い順に並ぶ", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes);
      const first = await service.executeDraw(REQUEST);
      const reveal = vi.spyOn(store, "reveal");
      const second = await service.executeDraw(REQUEST);
      expect(reveal).not.toHaveBeenCalled();
      expect((await store.unrevealed()).map((r) => r.drawId)).toEqual([first.result.drawId, second.result.drawId]);
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

  describe("restoreUnrevealed(ホストの再読み込み)", () => {
    it("未公開が無ければ null", async () => {
      const { service, prizes } = setup();
      await service.initializeStateIfNeeded(prizes);
      expect(await service.restoreUnrevealed()).toBeNull();
    });

    it("複数あれば、古い分を古い順に公開し、最後の1件だけ返す", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes);
      const a = await service.executeDraw(REQUEST);
      const b = await service.executeDraw(REQUEST);
      const c = await service.executeDraw(REQUEST);
      const reveal = vi.spyOn(store, "reveal");
      const resume = await service.restoreUnrevealed();
      expect(resume?.drawId).toBe(c.result.drawId);
      expect(reveal.mock.calls.map((x) => x[0])).toEqual([a.result.drawId, b.result.drawId]);
      expect((await store.unrevealed()).map((r) => r.drawId)).toEqual([c.result.drawId]);
    });
  });

  describe("resumeDraw", () => {
    it("引き直さず、確定済みの当選者・景品のまま、ダミーだけを作り直す", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      const { result } = await service.executeDraw(REQUEST);
      const pending = (await store.unrevealed())[0];
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
      const resumed = await service.resumeDraw((await store.unrevealed())[0]);
      expect(resumed.result.isKakuhen).toBe(true);
      expect(resumed.prizeRes.isKakuhen).toBe(true);
      expect(resumed.prizeRes.winnerPrizeId).toBe(result.wonPrize!.id);
      expect(resumed.prizeRes.dummyWinnerPrizeId).toBeTruthy();
      expect(resumed.prizeRes.dummyWinnerPrizeId).not.toBe(result.wonPrize!.id);
    });

    it("確変の当選景品にダミーの指定があれば、その景品がダミー当選になる", async () => {
      const prizes = prizeList.map((p) => (p.id === "p1" ? { ...p, kakuhenDummyPrizeId: "p5" } : p.id === "p2" ? { ...p, kakuhenDummyPrizeId: "p4" } : p));
      const { service, store } = setup({ prizes });
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [1] });
      const { result } = await service.executeDraw(REQUEST);
      const resumed = await service.resumeDraw((await store.unrevealed())[0]);
      expect(resumed.prizeRes.isKakuhen).toBe(true);
      expect(resumed.prizeRes.dummyWinnerPrizeId).toBe(result.wonPrize!.id === "p1" ? "p5" : "p4");
    });

    it("ダミーの指定が存在しない景品・当選景品自身なら、指定を無視してランダムに選ぶ", async () => {
      const prizes = prizeList.map((p) => (p.id === "p1" ? { ...p, kakuhenDummyPrizeId: "ghost" } : p.id === "p2" ? { ...p, kakuhenDummyPrizeId: "p2" } : p));
      const { service, store } = setup({ prizes });
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [1] });
      const { result } = await service.executeDraw(REQUEST);
      const resumed = await service.resumeDraw((await store.unrevealed())[0]);
      const dummy = resumed.prizeRes.dummyWinnerPrizeId;
      expect(dummy).toBeTruthy();
      expect(dummy).not.toBe("ghost");
      expect(dummy).not.toBe(result.wonPrize!.id);
      expect(prizes.map((p) => p.id)).toContain(dummy);
    });

    it("当選者がメンバー名簿に見つからなければ、理由の分かる例外", async () => {
      const { service } = setup();
      await expect(
        service.resumeDraw({ drawId: "d", wonMember: { id: "ghost", name: "幽霊" }, wonPrize: prizeList[0], isKakuhen: false, createdAt: 1 })
      ).rejects.toThrow(/幽霊/);
    });
  });

  describe("skipWinner(不在の当選者を飛ばす)", () => {
    it("同じ景品・同じ確変の回のまま当選者だけが替わり、元の当選者は除外され、公開前に戻る", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [1] });
      const { result } = await service.executeDraw(REQUEST);
      await store.reveal(result.drawId);

      const skipped = await service.skipWinner(result.drawId, REQUEST);

      expect(skipped.result).toMatchObject({ drawId: result.drawId, isKakuhen: true, wonPrize: { id: result.wonPrize!.id } });
      expect(skipped.result.wonMember!.id).not.toBe(result.wonMember!.id);
      expect(skipped.memberRes).toMatchObject({ drawId: result.drawId, winnerId: skipped.result.wonMember!.id });
      expect(skipped.memberRes.dummyIds).not.toContain(skipped.result.wonMember!.id);
      expect(skipped.memberRes.dummyIds).not.toContain(result.wonMember!.id);
      expect(await store.excludedMemberIds()).toEqual([result.wonMember!.id]);
      expect((await store.unrevealed())[0]).toMatchObject({ drawId: result.drawId, wonMember: { id: skipped.result.wonMember!.id }, wonPrize: { id: result.wonPrize!.id } });
      expect(await store.results()).toHaveLength(1);
    });

    it("飛ばした人は、あとの抽選にも出ない。最後まで通しても、当選者の重複は0(飛ばした人は当選しない)", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      const first = await service.executeDraw(REQUEST);
      await store.reveal(first.result.drawId);
      const skipped = await service.skipWinner(first.result.drawId, REQUEST);
      await store.reveal(first.result.drawId);
      const absent = first.result.wonMember!.id;
      // 残りの候補(4人 - 飛ばした1人 = 3人のうち、1人は替わりの当選者)を最後まで引く
      for (;;) {
        const next = await service.drawNext(REQUEST);
        if (next.kind === "finished") {
          expect(next.progress.endReason).toBe("members");
          expect(next.progress.eligibleMembers).toBe(3); // 飛ばした人は、対象の人数に数えない
          break;
        }
        await store.reveal(next.outcome.result.drawId);
      }
      const ids = (await store.results()).map((r) => r.wonMember!.id);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).not.toContain(absent);
      expect(ids).toContain(skipped.result.wonMember!.id);
    });

    it("対象(エントリーした人)の中に、ほかの候補がいなければ、人数の分かる理由の例外。何も変わらない", async () => {
      const { service, store, prizes } = setup({ eligibleMemberIds: ["alice"] });
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      const { result } = await service.executeDraw(REQUEST);
      await expect(service.skipWinner(result.drawId, REQUEST)).rejects.toThrow(NoEligibleMembersError);
      expect(await store.excludedMemberIds()).toEqual([]);
      expect((await store.results())[0].wonMember!.id).toBe("alice");
    });

    it("存在しない抽選は DrawConflictError", async () => {
      const { service, prizes } = setup();
      await service.initializeStateIfNeeded(prizes);
      await expect(service.skipWinner("nope", REQUEST)).rejects.toThrow(DrawConflictError);
    });

    it("残りの候補の人数(spareMembers)を返す。抽選(drawNext)・再開(resumeDraw)・飛ばした後で、同じ数え方", async () => {
      const { service, store, prizes } = setup(); // 4人
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      const next = await service.drawNext(REQUEST);
      if (next.kind !== "drawn") throw new Error("drawn のはず");
      expect(next.outcome.spareMembers).toBe(3);
      expect((await service.resumeDraw((await store.unrevealed())[0])).spareMembers).toBe(3);
      const skipped = await service.skipWinner(next.outcome.result.drawId, REQUEST);
      expect(skipped.spareMembers).toBe(2); // 元の人と替わりの人を除いた残り
      expect((await service.resumeDraw((await store.unrevealed())[0])).spareMembers).toBe(2);
    });

    it("再開(別セッションの読み直し)後も除外が残る: 別のサービスが同じ保存先を読んでも、飛ばした人は引かれない", async () => {
      const { service, store, prizes } = setup();
      await service.initializeStateIfNeeded(prizes, { mode: "fixed", fixedTimings: [] });
      const { result } = await service.executeDraw(REQUEST);
      await service.skipWinner(result.drawId, REQUEST);
      await store.load();
      const resumed = await service.resumeDraw((await store.unrevealed())[0]);
      expect(resumed.memberRes.dummyIds).not.toContain(result.wonMember!.id);
      expect(await store.excludedMemberIds()).toEqual([result.wonMember!.id]);
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

describe("確変の決め方「なし」", () => {
  it("確変対応ありの景品も取り置かず(通常の抽選で当たる)、確変の回も無い。おまかせなら取り置く", async () => {
    const none = setup();
    const planNone = await none.service.initializeStateIfNeeded(none.prizes, { mode: "none", fixedTimings: [] });
    expect(planNone).toMatchObject({ kakuhenTimings: [], reservedPrizeIds: [] });

    const auto = setup();
    const planAuto = await auto.service.initializeStateIfNeeded(auto.prizes);
    expect(planAuto.reservedPrizeIds).toEqual(["p1", "p2"]);

    // なしでは、確変対応ありの景品も含めて全景品を、確変でない演出で引ける
    const drawn: boolean[] = [];
    for (let i = 0; i < none.prizes.length; i++) {
      const next = await none.service.drawNext(REQUEST);
      if (next.kind !== "drawn") break;
      drawn.push(next.outcome.result.isKakuhen ?? false);
      await none.store.reveal(next.outcome.result.drawId);
    }
    expect(drawn).toHaveLength(4); // 対象メンバー4人まで
    expect(drawn.every((k) => !k)).toBe(true);
  });
});


describe("当選対象(drawable)", () => {
  type TestPrize = (typeof prizeList)[number] & { drawable?: boolean; kakuhenDummyPrizeId?: string };
  const prizesWithDecoys: TestPrize[] = [
    { id: "a", name: "A", rank: 3, order: 1, kakuhen: true, kakuhenDummyPrizeId: "b" },
    { id: "b", name: "B", rank: 3, order: 2, kakuhen: true, kakuhenDummyPrizeId: "a" },
    { id: "n1", name: "N1", rank: 5, order: 3, kakuhen: true, drawable: false },
    { id: "n2", name: "N2", rank: 3, order: 4, kakuhen: false, drawable: false },
    { id: "c", name: "C", rank: 3, order: 5, kakuhen: false },
  ];

  async function drawAll(prizes: TestPrize[], plan?: { mode: "fixed"; fixedTimings: number[] }) {
    const t = setup({ prizes: prizes as never });
    await t.service.initializeStateIfNeeded(prizes as never, plan);
    const won: string[] = [];
    const dummies: (string | null)[] = [];
    for (let i = 0; i < 10; i++) {
      const next = await t.service.drawNext(REQUEST);
      if (next.kind !== "drawn") break;
      won.push(next.outcome.result.wonPrize!.id);
      dummies.push(next.outcome.prizeRes.dummyWinnerPrizeId ?? null);
      await t.store.reveal(next.outcome.result.drawId);
    }
    return { won, dummies, t };
  }

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("当選対象でない景品は、確変でも通常でも、何度やっても当たらない。取り置きにも入らない", async () => {
    for (let i = 0; i < 40; i++) {
      const { won, t } = await drawAll(prizesWithDecoys);
      expect(won.filter((id) => id.startsWith("n"))).toEqual([]);
      expect([...won].sort()).toEqual(["a", "b", "c"]);
      expect((await t.store.plan())?.reservedPrizeIds.sort()).toEqual(["a", "b"]);
    }
  });

  it("A と B を互いのダミーにして、両方とも確変・当選対象なら、両方とも当たり得る", async () => {
    const winnersByTurn: Record<string, Set<string>> = {};
    for (let i = 0; i < 60; i++) {
      const { won } = await drawAll(prizesWithDecoys.filter((p) => p.id !== "n1" && p.id !== "n2" && p.id !== "c"), { mode: "fixed", fixedTimings: [1, 2] });
      (winnersByTurn["first"] ??= new Set()).add(won[0]);
    }
    expect([...winnersByTurn["first"]].sort()).toEqual(["a", "b"]);
  });

  it("確変の回のダミー当選には、当選対象でない景品も指定・抽選できる", async () => {
    const prizes: TestPrize[] = [
      { id: "a", name: "A", rank: 3, order: 1, kakuhen: true, kakuhenDummyPrizeId: "n1" },
      { id: "n1", name: "N1", rank: 3, order: 2, kakuhen: false, drawable: false },
    ];
    const { won, dummies } = await drawAll(prizes, { mode: "fixed", fixedTimings: [1] });
    expect(won).toEqual(["a"]);
    expect(dummies).toEqual(["n1"]);
    const noDesignation = prizes.map((p) => ({ ...p, kakuhenDummyPrizeId: undefined }));
    const r = await drawAll(noDesignation, { mode: "fixed", fixedTimings: [1] });
    expect(r.dummies).toEqual(["n1"]);
  });
});
