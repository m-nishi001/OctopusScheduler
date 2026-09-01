import { describe, it, expect } from "vitest";
import { WeightedSelector } from "../weighted-selector";
import { MockRandom } from "./test-utils";

describe("WeightedSelector", () => {
  /**
   * selectWeightedメソッドが最小ランクのアイテムを選択し、ランダムプロバイダーでタイを解消することをテストする。
   * 期待値: 最小ランクは1で、ランダム0で最初の候補（b）を選択。
   */
  it("selects item with minimum rank and uses random provider to break ties", () => {
    // Now rank is treated as weight (higher rank -> higher chance).
    // Example: ranks [1,1,8] total=10. Provide deterministic random to select each.
    // next() returns float in [0,1), selectWeighted multiplies by total.
    const sel1 = new WeightedSelector(new MockRandom([0.05]) as any);
    const pool1: { id: string; rank: number }[] = [
      { id: "a", rank: 1 },
      { id: "b", rank: 1 },
      { id: "c", rank: 8 },
    ];
    // r = 0.05*10 = 0.5 -> falls into first item's weight (a)
    expect(sel1.selectWeighted(pool1).id).toBe("a");

    const sel2 = new WeightedSelector(new MockRandom([0.15]) as any);
    // r = 0.15*10 = 1.5 -> falls into second item's weight (b)
    expect(sel2.selectWeighted(pool1).id).toBe("b");

    const sel3 = new WeightedSelector(new MockRandom([0.5]) as any);
    // r = 0.5*10 = 5 -> falls into third item's weight (c)
    expect(sel3.selectWeighted(pool1).id).toBe("c");
  });

  /**
   * shuffleWithWeightsメソッドがランクごとにグループを保持し、グループ内でシャッフルすることをテストする。
   * 期待値: グループ[a,b]と[c,d]で、シャッフル後も長さとIDが同じ。
   */
  it("shuffleWithWeights keeps groups by rank and shuffles within group", () => {
    // provide deterministic random sequence to force swaps
    const rand = new MockRandom([0.5, 0.0, 0.25, 0.75]);
    const sel = new WeightedSelector(rand as any);
    const items: { id: string; rank: number }[] = [
      { id: "a", rank: 1 },
      { id: "b", rank: 1 },
      { id: "c", rank: 2 },
      { id: "d", rank: 2 },
    ];
    const shuffled = sel.shuffleWithWeights(items) as any[];
    // groups: rank 2 group should come first (higher rank first) then rank 1
    expect(shuffled.map((s) => s.id).sort()).toEqual(["a", "b", "c", "d"]);
    expect(shuffled.length).toBe(4);
  });
});
