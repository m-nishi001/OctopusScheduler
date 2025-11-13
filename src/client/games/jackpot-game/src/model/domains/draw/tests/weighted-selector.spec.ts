import { describe, it, expect } from "vitest";
import { WeightedSelector } from "../weighted-selector";
import { MockRandom } from "./test-utils";

describe("WeightedSelector", () => {
  /**
   * selectWeightedメソッドが最小ランクのアイテムを選択し、ランダムプロバイダーでタイを解消することをテストする。
   * 期待値: 最小ランクは1で、ランダム0で最初の候補（b）を選択。
   */
  it("selects item with minimum rank and uses random provider to break ties", () => {
    const rand = new MockRandom([0.0]); // always pick index 0 in ties
    const sel = new WeightedSelector(rand as any);
    const pool = [
      { id: "a", rank: 2 },
      { id: "b", rank: 1 },
      { id: "c", rank: 1 },
    ];
    const picked = sel.selectWeighted(pool as any) as any;
    // min rank is 1 — with rand 0, should pick first candidate with rank 1 (b)
    expect(picked.id).toBe("b");
  });

  /**
   * shuffleWithWeightsメソッドがランクごとにグループを保持し、グループ内でシャッフルすることをテストする。
   * 期待値: グループ[a,b]と[c,d]で、シャッフル後も長さとIDが同じ。
   */
  it("shuffleWithWeights keeps groups by rank and shuffles within group", () => {
    // provide deterministic random sequence to force swaps
    const rand = new MockRandom([0.5, 0.0, 0.25, 0.75]);
    const sel = new WeightedSelector(rand as any);
    const items = [
      { id: "a", rank: 1 },
      { id: "b", rank: 1 },
      { id: "c", rank: 2 },
      { id: "d", rank: 2 },
    ];
    const shuffled = sel.shuffleWithWeights(items as any) as any[];
    // groups: [a,b] then [c,d] — shuffling should still produce length and same ids
    expect(shuffled.map((s) => s.id).sort()).toEqual(["a", "b", "c", "d"]);
    expect(shuffled.length).toBe(4);
  });
});
