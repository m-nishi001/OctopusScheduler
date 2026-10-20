import { describe, it, expect } from "vitest";
import {
  WeightedSelector,
  resolveWeight,
  DEFAULT_WEIGHT,
  MIN_WEIGHT,
  MAX_WEIGHT,
} from "./weighted-selector";
import { MockRandom } from "./test-utils";

describe("WeightedSelector", () => {
  describe("selectWeighted", () => {
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
      expect(sel1.selectWeighted(pool).id).toBe("a");

      const sel2 = new WeightedSelector(new MockRandom([0.15]) as any);
      // r = 0.15*10 = 1.5 -> falls into second item's weight (b)
      expect(sel2.selectWeighted(pool).id).toBe("b");

      const sel3 = new WeightedSelector(new MockRandom([0.5]) as any);
      // r = 0.5*10 = 5 -> falls into third item's weight (c)
      expect(sel3.selectWeighted(pool).id).toBe("c");
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
      expect(sel.selectWeighted(pool).id).toBe("grand");

      // r within the tiny common-item slice selects common.
      const selCommon = new WeightedSelector(new MockRandom([0.0]) as any);
      expect(selCommon.selectWeighted(pool).id).toBe("common");
    });

    /**
     * weight未設定の景品はデフォルト値にフォールバックすることをテストする。
     */
    it("falls back to the default weight when unset", () => {
      const pool: Array<{ id: string; weight?: number }> = [{ id: "a" }, { id: "b" }];
      const sel = new WeightedSelector(new MockRandom([0]) as any);
      // Both resolve to DEFAULT_WEIGHT, so total = 2*DEFAULT_WEIGHT and r=0 selects the first.
      expect(sel.selectWeighted(pool).id).toBe("a");
    });

    it("throws on an empty pool", () => {
      const sel = new WeightedSelector(new MockRandom([0]) as any);
      expect(() => sel.selectWeighted([])).toThrow();
    });
  });

  describe("resolveWeight", () => {
    it("returns the default when weight is undefined", () => {
      expect(resolveWeight(undefined)).toBe(DEFAULT_WEIGHT);
    });

    it("returns the default for NaN/Infinity", () => {
      expect(resolveWeight(NaN)).toBe(DEFAULT_WEIGHT);
      expect(resolveWeight(Infinity)).toBe(DEFAULT_WEIGHT);
    });

    it("clamps to [MIN_WEIGHT, MAX_WEIGHT]", () => {
      expect(resolveWeight(-5)).toBe(MIN_WEIGHT);
      expect(resolveWeight(0)).toBe(MIN_WEIGHT);
      expect(resolveWeight(1000)).toBe(MAX_WEIGHT);
    });

    it("floors fractional weights", () => {
      expect(resolveWeight(12.7)).toBe(12);
    });
  });
});
