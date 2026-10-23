import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { createInMemoryDrawApp } from "./in-memory-draw-app";
import type { DrawApplicationService } from "./draw-application-service";
import { AllMembersDrawPool } from "../../model/draw/draw-pool";
import type { DrawPoolProvider } from "../../model/draw/draw-pool";
import { NoEligibleMembersError } from "../../model/errors";
import type { KakuhenPlan } from "../../model/draw/kakuhen-plan";

/** 全員・全景品を最後まで引き切る通しの検証（本番と同じ抽選ロジック + メモリ上の保存先）。 */
function build(memberCount: number, prizeCount: number, weights?: (i: number) => number | undefined, pool: DrawPoolProvider = new AllMembersDrawPool()) {
  const members = Array.from({ length: memberCount }, (_, i) => ({ id: `m${i}`, name: `M${i}`, rank: 1 }));
  const prizes = Array.from({ length: prizeCount }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    order: i + 1,
    weight: weights ? weights(i) : 10,
  }));
  const { app, store } = createInMemoryDrawApp({ members, prizes, pool });
  return {
    service: app,
    store,
    prizes,
    members,
    initializer: { initialize: (target: typeof prizes, plan?: KakuhenPlan) => app.initializeStateIfNeeded(target, plan) },
  };
}

const MEMBER_COUNTS = [1, 2, 3, 5, 10, 50, 300];
const PRIZE_COUNTS = [1, 2, 3, 4, 5, 10, 30, 100];

describe("通し抽選: 人数 × 景品数マトリクス", () => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  for (const m of MEMBER_COUNTS) {
    for (const p of PRIZE_COUNTS) {
      it(`メンバー${m}人 × 景品${p}件: 例外なく引き切り、重複当選がない`, async () => {
        const { service, store, prizes, initializer } = build(m, p, (i) => (i % 3 === 0 ? 100 : i % 3 === 1 ? 1 : undefined));
        await initializer.initialize(prizes as any);
        const draws = Math.min(m, p);
        const wonMembers = new Set<string>();
        const wonPrizes = new Set<string>();
        for (let i = 0; i < draws; i++) {
          const { result, prizeRes, memberRes } = await service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
          expect(result.wonMember, `draw ${i}`).toBeTruthy();
          expect(result.wonPrize, `draw ${i}`).toBeTruthy();
          expect(wonMembers.has(result.wonMember!.id), `member dup draw ${i}`).toBe(false);
          expect(wonPrizes.has(result.wonPrize!.id), `prize dup draw ${i}`).toBe(false);
          // アニメーション用の素材: ダミーは本物と重ならず、ダミー同士も重複しない
          expect(prizeRes.dummyPrizeIds).not.toContain(prizeRes.winnerPrizeId);
          // 景品がダミー枠より少ないときだけ、枠を埋めるために重複を許す
          expect(new Set(prizeRes.dummyPrizeIds).size).toBe(
            prizeRes.isKakuhen ? prizeRes.dummyPrizeIds.length : Math.min(prizeRes.dummyPrizeIds.length, p - 1)
          );
          if (prizeRes.isKakuhen && prizeRes.dummyWinnerPrizeId) {
            expect(prizeRes.dummyWinnerPrizeId).not.toBe(prizeRes.winnerPrizeId);
          }
          expect(memberRes.dummyIds).not.toContain(memberRes.winnerId);
          wonMembers.add(result.wonMember!.id);
          wonPrizes.add(result.wonPrize!.id);
        }
        // 確定した件数が引いた回数と一致する(景品 <= メンバーなら全景品が当選済み)
        expect((await store.results()).length).toBe(draws);
      });
    }
  }
});

describe("通し抽選: 異常な入力", () => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("メンバー0人・景品0件でも初期化で落ちず、抽選は明示的なエラーになる", async () => {
    const { service, initializer } = build(0, 0);
    await initializer.initialize([]);
    await expect(service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 })).rejects.toThrow();
  });

  it("全員当選後の追加抽選は明示的なエラーになり、結果を壊さない", async () => {
    const { service, store, prizes, initializer } = build(2, 5);
    await initializer.initialize(prizes as any);
    await service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
    await service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
    const before = (await store.results()).length;
    await expect(service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 })).rejects.toThrow();
    expect((await store.results()).length).toBe(before);
  });
});

describe("通し抽選: 抽選の対象（エントリーした人だけ）", () => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  const run = async (memberCount: number, prizeCount: number, eligible: string[], draws: number) => {
    const { service, prizes, initializer } = build(memberCount, prizeCount, undefined, { getEligibleMemberIds: async () => eligible });
    await initializer.initialize(prizes as any);
    const out: Array<{ member: string; dummies: string[] }> = [];
    for (let i = 0; i < draws; i++) {
      const { result, memberRes } = await service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
      out.push({ member: result.wonMember!.id, dummies: memberRes.dummyIds });
    }
    return { out, service };
  };

  it("全員当選するまで、当選者は必ずエントリーした人で、重複せず、リールのダミーも対象の中だけ", async () => {
    const eligible = ["m3", "m7", "m11", "m20", "m42"];
    const { out } = await run(50, 10, eligible, eligible.length);
    expect(out.map((o) => o.member).sort()).toEqual([...eligible].sort());
    for (const o of out) for (const d of o.dummies) expect(eligible).toContain(d);
  });

  it("対象の人数より景品が多くても、対象の全員が当選したら明示的なエラーになり、結果を壊さない", async () => {
    const eligible = ["m1", "m2"];
    const { service } = await run(10, 6, eligible, 2);
    await expect(service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 })).rejects.toThrow(NoEligibleMembersError);
  });

  it("エントリーした人が1人でも、その人が当選する（リールのダミーは重複して埋める）", async () => {
    const { out } = await run(30, 5, ["m9"], 1);
    expect(out[0].member).toBe("m9");
    expect(out[0].dummies.every((d) => d === "m9" || d === undefined)).toBe(true);
  });

  it("エントリー者が大勢でも（300人中200人）、当選者は常に対象の中", async () => {
    const eligible = Array.from({ length: 200 }, (_, i) => `m${i * 1}`);
    const { out } = await run(300, 40, eligible, 40);
    for (const o of out) expect(eligible).toContain(o.member);
    expect(new Set(out.map((o) => o.member)).size).toBe(40);
  });
});

describe("通し抽選: 終了の判定(景品 > メンバー でも終わる)", () => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  /** 進行役と同じ手順: 終了でない限り抽選する。終了までの抽選回数と終了の理由を返す。 */
  const runUntilEnd = async (service: DrawApplicationService, limit = 1000) => {
    let draws = 0;
    for (;;) {
      const progress = await service.getDrawProgress();
      if (progress.endReason) return { draws, progress };
      if (draws >= limit) throw new Error("終了しない");
      await service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
      draws++;
    }
  };

  for (const m of [1, 2, 4, 5, 10]) {
    for (const p of [1, 3, 4, 5, 10, 30]) {
      it(`メンバー${m}人 × 景品${p}件: ${Math.min(m, p)}回で、例外なく終了する(理由: ${p <= m ? "景品" : "メンバー"})`, async () => {
        const { service, prizes, initializer } = build(m, p);
        await initializer.initialize(prizes as any);
        const { draws, progress } = await runUntilEnd(service);
        expect(draws).toBe(Math.min(m, p));
        expect(progress.endReason).toBe(p <= m ? "prizes" : "members");
        expect(progress.remainingMembers).toBe(Math.max(0, m - draws));
      });
    }
  }

  it("メンバー4人 × 景品10件(今回の不具合): 4人目の後は、景品が残っていても終了(メンバー)になり、続けて抽選しない", async () => {
    const { service, prizes, initializer } = build(4, 10);
    await initializer.initialize(prizes as any);
    const { draws, progress } = await runUntilEnd(service);
    expect(draws).toBe(4);
    expect(progress).toMatchObject({ endReason: "members", remainingMembers: 0 });
    expect(progress.remainingPrizes).toBeGreaterThan(0);
  });

  it("抽選の対象を絞っていれば、対象の人数で終わる(エントリー3人 × 景品10件 → 3回)", async () => {
    const { service, prizes, initializer } = build(50, 10, undefined, { getEligibleMemberIds: async () => ["m1", "m2", "m3"] });
    await initializer.initialize(prizes as any);
    const { draws, progress } = await runUntilEnd(service);
    expect(draws).toBe(3);
    expect(progress.endReason).toBe("members");
  });

  it("対象の一覧を取得できないときは、終了と見なさず例外のまま(誤って抽選を終わらせない)", async () => {
    const { service, prizes, initializer } = build(4, 10, undefined, {
      getEligibleMemberIds: async () => Promise.reject(new Error("一覧を取得できません")),
    });
    await initializer.initialize(prizes as any);
    await expect(service.getDrawProgress()).rejects.toThrow("一覧を取得できません");
  });

  it("開始前(誰も当選していない)は続けられる", async () => {
    const { service, prizes, initializer } = build(4, 10);
    await initializer.initialize(prizes as any);
    expect(await service.getDrawProgress()).toMatchObject({ endReason: null, remainingMembers: 4, drawn: 0 });
  });

  it("抽選の対象が0人・景品が0件でも、1回も抽選していないうちは終了にしない(設定の問題として、抽選の失敗で理由を知らせる)", async () => {
    const noEntrants = build(10, 5, undefined, { getEligibleMemberIds: async () => [] });
    await noEntrants.initializer.initialize(noEntrants.prizes as any);
    expect(await noEntrants.service.getDrawProgress()).toMatchObject({ endReason: null, remainingMembers: 0, drawn: 0 });
    await expect(noEntrants.service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 })).rejects.toThrow(NoEligibleMembersError);

    const noPrizes = build(4, 0);
    await noPrizes.initializer.initialize([]);
    expect(await noPrizes.service.getDrawProgress()).toMatchObject({ endReason: null, remainingPrizes: 0, drawn: 0 });
  });

  it("抽選したあとにリロードしても(結果が残っている)、尽きていれば終了と判定する", async () => {
    const { service, prizes, initializer } = build(2, 5);
    await initializer.initialize(prizes as any);
    await service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
    await service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
    expect(await service.getDrawProgress()).toMatchObject({ endReason: "members", drawn: 2 });
  });
});

describe("通し抽選: 確変にする回の計画", () => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  /** 景品 `prizeCount` 件を引き切り、何回目が確変だったか（1始まり）を返す。 */
  const kakuhenDraws = async (prizeCount: number, plan?: KakuhenPlan) => {
    const { service, prizes, initializer, store } = build(prizeCount + 3, prizeCount);
    await initializer.initialize(prizes as never, plan);
    const flags: boolean[] = [];
    for (let i = 0; i < prizeCount; i++) {
      const { prizeRes } = await service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
      flags.push(prizeRes.isKakuhen === true);
    }
    return { draws: flags.flatMap((f, i) => (f ? [i + 1] : [])), reserved: (await store.plan())!.reservedPrizeIds.length - (await store.results()).filter((r) => r.isKakuhen).length };
  };

  it("計画を渡さなければ、これまでどおり景品の真ん中あたりで続けて2回", async () => {
    expect((await kakuhenDraws(10)).draws).toEqual([5, 6]);
  });

  it("回を指定すると、指定した回だけが確変になる", async () => {
    const { draws, reserved } = await kakuhenDraws(10, { mode: "fixed", fixedTimings: [3, 8] });
    expect(draws).toEqual([3, 8]);
    expect(reserved).toBe(0); // 予約した景品はすべて使われる
  });

  it("最初の回・最後から2番目の回も指定できる", async () => {
    expect((await kakuhenDraws(6, { mode: "fixed", fixedTimings: [1, 5] })).draws).toEqual([1, 5]);
  });

  it("指定が空なら確変なし", async () => {
    expect((await kakuhenDraws(10, { mode: "fixed", fixedTimings: [] })).draws).toEqual([]);
  });

  it("景品の数を超える回は無視する", async () => {
    expect((await kakuhenDraws(4, { mode: "fixed", fixedTimings: [2, 4, 9] })).draws).toEqual([2, 4]);
  });

  it("通常の抽選用に景品を1件は残すので、全部の回を指定しても、確変は景品の数-1回まで", async () => {
    expect((await kakuhenDraws(4, { mode: "fixed", fixedTimings: [1, 2, 3, 4] })).draws).toEqual([1, 2, 3]);
  });

  it("計画は最初の1回で確定し、あとから別の計画で初期化しても変わらない", async () => {
    const { service, prizes, initializer } = build(13, 10);
    await initializer.initialize(prizes as never, { mode: "fixed", fixedTimings: [2] });
    await initializer.initialize(prizes as never, { mode: "fixed", fixedTimings: [9] }); // 無視される
    const flags: boolean[] = [];
    for (let i = 0; i < 10; i++) flags.push((await service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 })).prizeRes.isKakuhen === true);
    expect(flags.flatMap((f, i) => (f ? [i + 1] : []))).toEqual([2]);
  });
});
