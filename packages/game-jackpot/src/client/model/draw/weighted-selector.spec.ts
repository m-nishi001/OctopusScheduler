import { describe, it, expect } from "vitest";
import {
  WeightedSelector,
  resolvePrizeWeight,
  DEFAULT_PRIZE_WEIGHT,
  MIN_PRIZE_WEIGHT,
  MAX_PRIZE_WEIGHT,
} from "./weighted-selector";
import { MockRandom } from "./test-utils";

describe("WeightedSelector", () => {
  describe("selectWeightedPrize", () => {
    /**
     * weightを重みとした累積和選択が期待通りの境界で切り替わることをテストする。
     */
    it("selects item using weight as cumulative-sum probability", () => {
      const sel1 = new WeightedSelector(new MockRandom([0.05]) as any);
      const pool: { id: string; weight: number }[] = [
        { id: "a", weight: 1 },
        { id: "b", weight: 1 },
        { id: "c", weight: 8 },
      ];
      // total=10, r = 0.05*10 = 0.5 -> falls into first item's weight (a)
      expect(sel1.selectWeightedPrize(pool).id).toBe("a");

      const sel2 = new WeightedSelector(new MockRandom([0.15]) as any);
      // r = 0.15*10 = 1.5 -> falls into second item's weight (b)
      expect(sel2.selectWeightedPrize(pool).id).toBe("b");

      const sel3 = new WeightedSelector(new MockRandom([0.5]) as any);
      // r = 0.5*10 = 5 -> falls into third item's weight (c)
      expect(sel3.selectWeightedPrize(pool).id).toBe("c");
    });

    /**
     * 広いレンジの重み(例: 1 vs 90)で、レア景品が実際に稀にしか選ばれないことをテストする。
     */
    it("supports a wide weight range so a rare prize stays rare", () => {
      const pool = [
        { id: "common", weight: 1 },
        { id: "grand", weight: 90 },
      ];
      // total=91, r just under the common item's boundary (1/91) still selects grand.
      const sel = new WeightedSelector(new MockRandom([0.02]) as any);
      expect(sel.selectWeightedPrize(pool).id).toBe("grand");

      // r within the tiny common-item slice selects common.
      const selCommon = new WeightedSelector(new MockRandom([0.0]) as any);
      expect(selCommon.selectWeightedPrize(pool).id).toBe("common");
    });

    /**
     * weight未設定の景品はデフォルト値にフォールバックすることをテストする。
     */
    it("falls back to the default weight when unset", () => {
      const pool = [{ id: "a" }, { id: "b" }];
      const sel = new WeightedSelector(new MockRandom([0]) as any);
      // Both resolve to DEFAULT_PRIZE_WEIGHT, so total = 2*DEFAULT_PRIZE_WEIGHT and r=0 selects the first.
      expect(sel.selectWeightedPrize(pool).id).toBe("a");
    });

    it("throws on an empty pool", () => {
      const sel = new WeightedSelector(new MockRandom([0]) as any);
      expect(() => sel.selectWeightedPrize([])).toThrow();
    });
  });

  describe("selectUniformRandom", () => {
    /**
     * selectUniformRandomは重みを無視し、rand.nextIntのみでインデックスを決めることをテストする。
     */
    it("picks purely by index, ignoring any weight-like fields", () => {
      const pool = [
        { id: "a", weight: 1 },
        { id: "b", weight: 999 },
        { id: "c", weight: 1 },
      ];
      const sel = new WeightedSelector(new MockRandom([0.5]) as any);
      // nextInt(3) with next()=0.5 -> floor(0.5*3)=1 -> index 1 regardless of weight
      expect(sel.selectUniformRandom(pool).id).toBe("b");
    });

    it("throws on an empty pool", () => {
      const sel = new WeightedSelector(new MockRandom([0]) as any);
      expect(() => sel.selectUniformRandom([])).toThrow();
    });
  });

  describe("resolvePrizeWeight", () => {
    it("returns the default when weight is undefined", () => {
      expect(resolvePrizeWeight(undefined)).toBe(DEFAULT_PRIZE_WEIGHT);
    });

    it("returns the default for NaN/Infinity", () => {
      expect(resolvePrizeWeight(NaN)).toBe(DEFAULT_PRIZE_WEIGHT);
      expect(resolvePrizeWeight(Infinity)).toBe(DEFAULT_PRIZE_WEIGHT);
    });

    it("clamps to [MIN_PRIZE_WEIGHT, MAX_PRIZE_WEIGHT]", () => {
      expect(resolvePrizeWeight(-5)).toBe(MIN_PRIZE_WEIGHT);
      expect(resolvePrizeWeight(0)).toBe(MIN_PRIZE_WEIGHT);
      expect(resolvePrizeWeight(1000)).toBe(MAX_PRIZE_WEIGHT);
    });

    it("floors fractional weights", () => {
      expect(resolvePrizeWeight(12.7)).toBe(12);
    });
  });
});
