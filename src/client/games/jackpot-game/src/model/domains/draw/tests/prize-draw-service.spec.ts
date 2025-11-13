import { describe, it, expect } from "vitest";
import { PrizeDrawService } from "../prize-draw-service";
import { MockRandom } from "./test-utils";

describe("PrizeDrawService", () => {
  /**
   * getAvailablePrizesメソッドが既に当選者に割り当てられている賞品をフィルタリングすることをテストする。
   * 期待値: 'a'はメンバーに割り当てられているので除外され、'b'は予約されているがメンバーがいないので利用可能、結果は["b", "c"]。
   */
  it("getAvailablePrizes filters prizes that are already assigned to winners", () => {
    const rand = new MockRandom([0]);
    const svc = new PrizeDrawService(null as any, rand as any);
    const prizes = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const results = [
      { wonPrize: { id: "a" }, wonMember: { id: "m1" } },
      { wonPrize: { id: "b" }, wonMember: null },
    ];
    const avail = svc.getAvailablePrizes(prizes as any, results as any);
    // 'a' is assigned to a member so excluded; 'b' reserved but no member -> still available
    expect(avail.map((p) => p.id).sort()).toEqual(["b", "c"]);
  });

  /**
   * selectRandomReservedメソッドが空の配列でエラーを投げ、それ以外では要素を返すことをテストする。
   * 期待値: 空の配列でエラーが投げられ、有効な配列では定義された要素が返される。
   */
  it("selectRandomReserved throws on empty and returns an element otherwise", () => {
    const rand = new MockRandom([0.3]);
    const svc = new PrizeDrawService(null as any, rand as any);
    expect(() => svc.selectRandomReserved([] as any)).toThrow();
    const arr = [{ drawId: "reserved-1" }, { drawId: "reserved-2" }];
    const sel = svc.selectRandomReserved(arr as any);
    expect(sel).toBeDefined();
  });

  /**
   * getRemainingPrizesメソッドが割り当てられた賞品（予約されていない）を無視し、予約されたものを保持することをテストする。
   * 期待値: p1は割り当てられているので削除、p2は予約されているので保持、p3は保持、結果は["p2", "p3"]。
   */
  it("getRemainingPrizes ignores assigned prizes (non-reserved) and keeps reserved ones", () => {
    const rand = new MockRandom([0]);
    const svc = new PrizeDrawService(null as any, rand as any);
    const prizes = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    const results = [
      { wonPrize: { id: "p1" }, wonMember: { id: "m1" }, drawId: "draw-1" },
      { wonPrize: { id: "p2" }, wonMember: null, drawId: "reserved-1" },
    ];
    const rem = svc.getRemainingPrizes(prizes as any, results as any);
    // p1 assigned -> removed; p2 reserved -> kept; p3 kept
    expect(rem.map((p) => p.id).sort()).toEqual(["p2", "p3"]);
  });

  /**
   * pickRandomPrizeFromメソッドが空の配列でnullを返し、それ以外では賞品を返すことをテストする。
   * 期待値: 空の配列でnullが返され、有効な配列では定義された賞品が返される。
   */
  it("pickRandomPrizeFrom returns null on empty and a prize otherwise", () => {
    const rand = new MockRandom([0.9]);
    const svc = new PrizeDrawService(null as any, rand as any);
    expect(svc.pickRandomPrizeFrom([] as any)).toBeNull();
    const prizes = [{ id: "x" }, { id: "y" }];
    const p = svc.pickRandomPrizeFrom(prizes as any);
    expect(p).toBeDefined();
  });

  /**
   * buildDummyPrizeIdsメソッドが提供されたIDを除外し、必要なサイズのダミーIDを返すことをテストする。
   * 期待値: 長さが2で、"p1"を含まない。
   */
  it("buildDummyPrizeIds excludes provided ids and returns required size", () => {
    const rand = new MockRandom([0.1, 0.2, 0.3]);
    const svc = new PrizeDrawService(null as any, rand as any);
    const prizes = [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }];
    const excluded = new Set(["p1"]);
    const d = svc.buildDummyPrizeIds(prizes as any, excluded, 2);
    expect(d.length).toBe(2);
    expect(d).not.toContain("p1");
  });
});
