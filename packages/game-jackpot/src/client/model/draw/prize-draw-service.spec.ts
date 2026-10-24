import { describe, it, expect } from "vitest";
import { PrizeDrawService } from "./prize-draw-service";
import { WeightedSelector } from "./weighted-selector";
import { MockRandom } from "./test-utils";

describe("PrizeDrawService", () => {
  it("getDrawablePrizes は、当選済みと確変のために取り置いた景品を除く", () => {
    const svc = new PrizeDrawService(null as any, new MockRandom([0]) as any);
    const prizes = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const results = [{ wonPrize: { id: "a" } }];
    expect(svc.getDrawablePrizes(prizes as any, results, ["b"]).map((p) => p.id)).toEqual(["c", "d"]);
    expect(svc.getDrawablePrizes(prizes as any, results).map((p) => p.id)).toEqual(["b", "c", "d"]);
  });

  it("getUnusedReservedPrizes は、取り置いた景品のうちまだ当選していないものだけ", () => {
    const svc = new PrizeDrawService(null as any, new MockRandom([0]) as any);
    const prizes = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(svc.getUnusedReservedPrizes(prizes as any, [{ wonPrize: { id: "b" } }], ["b", "c"]).map((p) => p.id)).toEqual(["c"]);
  });

  /**
   * 次の抽選が確変かは、「確定済みの件数 + 1」回目が確変の回に含まれるかで決まる(取り置きの行の数には依存しない)。
   */
  it("isKakuhenTurn は確定済みの件数 + 1 回目で判定する", () => {
    const svc = new PrizeDrawService(null as any, new MockRandom([0]) as any);
    expect(svc.isKakuhenTurn(0, [1, 3])).toBe(true);
    expect(svc.isKakuhenTurn(1, [1, 3])).toBe(false);
    expect(svc.isKakuhenTurn(2, [1, 3])).toBe(true);
    expect(svc.isKakuhenTurn(5, [])).toBe(false);
  });

  it("selectRandomReserved throws on empty and returns an element otherwise", () => {
    const svc = new PrizeDrawService(null as any, new MockRandom([0.3]) as any);
    expect(() => svc.selectRandomReserved([])).toThrow();
    expect(svc.selectRandomReserved([{ id: "x" }, { id: "y" }])).toBeDefined();
  });

  /**
   * getRemainingPrizes は、当選済み(確定済みの結果にある)景品だけを除く。取り置きの景品は、当選するまで残りに数える。
   */
  it("getRemainingPrizes removes only prizes that already won", () => {
    const svc = new PrizeDrawService(null as any, new MockRandom([0]) as any);
    const prizes = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
    const rem = svc.getRemainingPrizes(prizes as any, [{ wonPrize: { id: "p1" } }]);
    expect(rem.map((p) => p.id)).toEqual(["p2", "p3"]);
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

  describe("drawPrize", () => {
    /**
     * drawPrizeがWeightedSelector.selectWeightedに委譲し、
     * 当選景品を除いたダミーIDを返すことをテストする。
     */
    it("delegates to WeightedSelector.selectWeighted and excludes the winner from dummies", () => {
      // r=0.05*total(10)=0.5 -> falls into the first prize's weight slice (p1).
      const rand = new MockRandom([0.05, 0.1, 0.2, 0.3]);
      const selector = new WeightedSelector(rand as any);
      const svc = new PrizeDrawService(selector, rand as any);
      const prizes = [
        { id: "p1", weight: 1 },
        { id: "p2", weight: 1 },
        { id: "p3", weight: 8 },
      ];
      const res = svc.drawPrize({
        prizes: prizes as any,
        assignedPrizeIds: [],
        member: { id: "m1" } as any,
        dummyCount: 2,
      });
      expect(res).not.toBeNull();
      expect(res!.winnerPrizeId).toBe("p1");
      expect(res!.dummyPrizeIds.length).toBe(2);
      expect(res!.dummyPrizeIds).not.toContain("p1");
    });

    it("returns null when no prizes are available after excluding assigned ones", () => {
      const rand = new MockRandom([0]);
      const selector = new WeightedSelector(rand as any);
      const svc = new PrizeDrawService(selector, rand as any);
      const prizes = [{ id: "p1", weight: 5 }];
      const res = svc.drawPrize({
        prizes: prizes as any,
        assignedPrizeIds: ["p1"],
        member: { id: "m1" } as any,
        dummyCount: 1,
      });
      expect(res).toBeNull();
    });
  });
});
