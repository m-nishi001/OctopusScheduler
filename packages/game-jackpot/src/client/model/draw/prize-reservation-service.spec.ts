import { describe, it, expect } from "vitest";
import { PrizeReservationService } from "./prize-reservation-service";
import { MockRandom } from "./test-utils";

describe("PrizeReservationService", () => {
  /**
   * calculateKakuhenTimings（おまかせ）は、確変の回数ぶんの連続した回を真ん中あたりに置き、景品の数を超えない。
   * 回数を省くと2回（従来どおり）: 0・1で、2で[1,2]、3で[1,2]、5で[2,3]、10で[5,6]。
   */
  it("calculateKakuhenTimings keeps the previous behavior for 2 turns and generalizes to N consecutive turns", () => {
    const s = new PrizeReservationService(new MockRandom([0]) as any);
    expect(s.calculateKakuhenTimings(0)).toEqual([]);
    expect(s.calculateKakuhenTimings(1)).toEqual([1]);
    expect(s.calculateKakuhenTimings(3)).toEqual([1, 2]);
    expect(s.calculateKakuhenTimings(4)).toEqual([2, 3]);
    expect(s.calculateKakuhenTimings(5)).toEqual([2, 3]);
    expect(s.calculateKakuhenTimings(9)).toEqual([4, 5]);
    expect(s.calculateKakuhenTimings(10)).toEqual([5, 6]);
    expect(s.calculateKakuhenTimings(10, undefined, 0)).toEqual([]);
    expect(s.calculateKakuhenTimings(10, undefined, 1)).toEqual([5]);
    expect(s.calculateKakuhenTimings(10, undefined, 3)).toEqual([4, 5, 6]);
    expect(s.calculateKakuhenTimings(10, undefined, 4)).toEqual([4, 5, 6, 7]);
    // 景品の数以上なら全部の回
    expect(s.calculateKakuhenTimings(4, undefined, 4)).toEqual([1, 2, 3, 4]);
    expect(s.calculateKakuhenTimings(4, undefined, 9)).toEqual([1, 2, 3, 4]);
  });

  it("calculateKakuhenTimings in fixed mode uses the given turns (in range) and ignores the count", () => {
    const s = new PrizeReservationService(new MockRandom([0]) as any);
    expect(s.calculateKakuhenTimings(5, { mode: "fixed", fixedTimings: [4, 2, 9] }, 1)).toEqual([2, 4]);
  });

  /**
   * reservePrizesメソッドが正しい数を選択し、reservedCount >= prizes.lengthのときにエラーを投げることをテストする。
   * 期待値: 長さが2で、IDが重複しない。4でエラーが投げられる。
   */
  it("reservePrizes picks the correct number and throws when reservedCount >= prizes.length", () => {
    const rand = new MockRandom([0.0, 0.4, 0.6, 0.2]);
    const svc = new PrizeReservationService(rand as any);
    const prizes = [
      { id: "p1", rank: 5 },
      { id: "p2", rank: 3 },
      { id: "p3", rank: 1 },
      { id: "p4", rank: 2 },
    ];
    const res = svc.reservePrizes(2, prizes as any);
    expect(res.length).toBe(2);
    // should not duplicate ids
    expect(new Set(res.map((r) => r.id)).size).toBe(2);

    expect(() => svc.reservePrizes(4, prizes as any)).toThrow();
  });

  /**
   * 2件取り置くときは、景品ランクが最も高い景品と最も低い景品の両端から1件ずつ選ぶ。
   */
  it("reservePrizes takes the top-rank and the lowest-rank prize when reserving two", () => {
    for (const seq of [[0.0], [0.9]]) {
      const svc = new PrizeReservationService(new MockRandom(seq) as any);
      const prizes = [
        { id: "p1", rank: 5 },
        { id: "p2", rank: 3 },
        { id: "p3", rank: 1 },
        { id: "p4", rank: 2 },
      ];
      const res = svc.reservePrizes(2, prizes as any);
      expect(res.map((r) => r.id).sort()).toEqual(["p1", "p3"]);
    }
  });

  /**
   * rank未設定(legacy相当)の景品が混在していてもデフォルト値扱いで
   * 例外なく予約できることをテストする。
   */
  it("reservePrizes tolerates prizes with an unset rank", () => {
    const rand = new MockRandom([0.1, 0.3]);
    const svc = new PrizeReservationService(rand as any);
    const prizes = [
      { id: "p1", rank: 5 },
      { id: "p2" },
      { id: "p3", rank: 2 },
    ];
    const res = svc.reservePrizes(1, prizes as any);
    expect(res.length).toBe(1);
  });
});
