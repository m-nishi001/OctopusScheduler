import { describe, it, expect } from "vitest";
import { MemberDrawService } from "./member-draw-service";
import { WeightedSelector } from "./weighted-selector";
import { MockRandom } from "./test-utils";

/** 本物の重み付き選択を使う（乱数だけを差し替える）。 */
function service(randomValues: number[]) {
  const rand = new MockRandom(randomValues);
  return new MemberDrawService(new WeightedSelector(rand as never), rand as never);
}

describe("MemberDrawService", () => {
  it("drawMember returns null when no candidates", () => {
    const members = [{ id: "m1" }];
    const drawResults = [{ wonMember: { id: "m1" } } as never];
    expect(service([0]).drawMember(members as never, drawResults, 1)).toBeNull();
  });

  it("drawMember returns a winner and dummy ids (winner is not a dummy)", () => {
    const members = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];
    const out = service([0, 0.5, 0.2]).drawMember(members as never, [], 2)!;
    expect(out.winnerId).toBeDefined();
    expect(out.dummyIds).toHaveLength(2);
    expect(out.dummyIds).not.toContain(out.winnerId);
  });

  it("すでに当選した人は候補から外れる", () => {
    const members = [{ id: "m1" }, { id: "m2" }];
    const won = [{ wonMember: { id: "m1" } } as never];
    expect(service([0]).drawMember(members as never, won, 0)!.winnerId).toBe("m2");
  });

  describe("メンバーごとの当選しやすさ（weight）", () => {
    // 重み 1 / 10 / 89 → 合計 100。乱数 r は [0,100) に対応: [0,1)=a, [1,11)=b, [11,100)=c
    const members = [
      { id: "a", weight: 1 },
      { id: "b", weight: 10 },
      { id: "c", weight: 89 },
    ];

    it("乱数が重みの区間のどこに入るかで当選者が決まる", () => {
      expect(service([0.005]).drawMember(members as never, [], 0)!.winnerId).toBe("a");
      expect(service([0.05]).drawMember(members as never, [], 0)!.winnerId).toBe("b");
      expect(service([0.5]).drawMember(members as never, [], 0)!.winnerId).toBe("c");
    });

    it("重みが大きい人ほど、たくさん当たる（乱数を等間隔に振った比率が重みに比例する）", () => {
      const draws = 1000;
      const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
      for (let i = 0; i < draws; i++) {
        const winner = service([(i + 0.5) / draws]).drawMember(members as never, [], 0)!.winnerId!;
        counts[winner]++;
      }
      expect(counts).toEqual({ a: 10, b: 100, c: 890 });
    });

    it("重みを付けない（または全員同じ）なら、全員が同じ確率", () => {
      const none = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
      const draws = 1000;
      const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
      for (let i = 0; i < draws; i++) counts[service([(i + 0.5) / draws]).drawMember(none as never, [], 0)!.winnerId!]++;
      expect(counts).toEqual({ a: 250, b: 250, c: 250, d: 250 });
    });

    it("範囲外の重み（0・大きすぎ）は 1〜100 に収める", () => {
      const odd = [
        { id: "zero", weight: 0 }, // → 1
        { id: "big", weight: 100000 }, // → 100
      ];
      // 合計 101: [0,1)=zero, [1,101)=big
      expect(service([0.001]).drawMember(odd as never, [], 0)!.winnerId).toBe("zero");
      expect(service([0.5]).drawMember(odd as never, [], 0)!.winnerId).toBe("big");
    });

    it("当選した人は、重みが大きくても次の抽選では候補にならない", () => {
      const won = [{ wonMember: { id: "c" } } as never];
      const out = service([0.99]).drawMember(members as never, won, 0)!;
      expect(out.winnerId).toBe("b");
    });
  });
});
