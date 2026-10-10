import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { DrawApplicationService } from "./draw-application-service";
import { DrawResultService } from "./draw-result-service";
import { DrawStateInitializer } from "./draw-state-initializer";
import { MemberDrawService } from "../../model/draw/member-draw-service";
import { PrizeDrawService } from "../../model/draw/prize-draw-service";
import { PrizeReservationService } from "../../model/draw/prize-reservation-service";
import { WeightedSelector } from "../../model/draw/weighted-selector";
import { MathRandomProvider } from "../../model/common/math-random-provider";
import type { DrawResultDto } from "./dto/draw-result-dto";

/** 全員・全景品を最後まで引き切る通しの検証(実サービス + インメモリ保存)。 */
function build(memberCount: number, prizeCount: number, weights?: (i: number) => number | undefined) {
  const members = Array.from({ length: memberCount }, (_, i) => ({ id: `m${i}`, name: `M${i}`, rank: 1 }));
  const prizes = Array.from({ length: prizeCount }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    order: i + 1,
    weight: weights ? weights(i) : 10,
  }));
  const rows: DrawResultDto[] = [];
  let state: number[] | null = null;
  const resultRepo = {
    getDrawResults: async () => rows.map((r) => ({ ...r })),
    getDrawResultById: async (id: string) => rows.find((r) => r.drawId === id) ?? null,
    addDrawResult: async (r: DrawResultDto) => void rows.push(r),
    updateDrawResult: async (r: DrawResultDto) => {
      const i = rows.findIndex((x) => x.drawId === r.drawId);
      if (i < 0) throw new Error("not found");
      rows[i] = r;
    },
    deleteDrawResult: async () => undefined,
    syncDrawResults: async () => ({ synced: 0 }),
  };
  const stateRepo = {
    getState: async () => state,
    saveState: async (s: number[]) => void (state = s),
    clearState: async () => void (state = null),
  };
  let n = 0;
  const idGen = { nextId: () => `d${n++}` };
  const rand = new MathRandomProvider();
  const selector = new WeightedSelector(rand);
  const resultService = new DrawResultService(resultRepo as any);
  const initializer = new DrawStateInitializer(
    new PrizeReservationService(rand),
    resultService,
    stateRepo as any,
    idGen as any
  );
  const service = new DrawApplicationService(
    { getMembers: async () => members } as any,
    { getPrizes: async () => prizes } as any,
    resultService,
    stateRepo as any,
    new MemberDrawService(selector, rand),
    new PrizeDrawService(selector, rand),
    idGen as any,
    initializer
  );
  return { service, rows, prizes, members, initializer };
}

const MEMBER_COUNTS = [1, 2, 3, 5, 10, 50, 300];
const PRIZE_COUNTS = [1, 2, 3, 4, 5, 10, 30, 100];

describe("通し抽選: 人数 × 景品数マトリクス", () => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  for (const m of MEMBER_COUNTS) {
    for (const p of PRIZE_COUNTS) {
      it(`メンバー${m}人 × 景品${p}件: 例外なく引き切り、重複当選がない`, async () => {
        const { service, rows, prizes, initializer } = build(m, p, (i) => (i % 3 === 0 ? 100 : i % 3 === 1 ? 1 : undefined));
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
        // 確定していない予約枠が残らない(景品 <= メンバーなら全景品が当選済み)
        const pending = rows.filter((r) => !r.wonMember);
        if (p <= m) expect(pending.length).toBe(0);
        expect(rows.filter((r) => r.wonMember).length).toBe(draws);
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
    const { service, rows, prizes, initializer } = build(2, 5);
    await initializer.initialize(prizes as any);
    await service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
    await service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 });
    const before = rows.length;
    await expect(service.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 })).rejects.toThrow();
    expect(rows.length).toBe(before);
  });
});
