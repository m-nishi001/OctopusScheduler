import { describe, it, expect } from "vitest";
import { PrizeReservationService } from "../prize-reservation-service";
import { MockRandom } from "./test-utils";

describe("PrizeReservationService", () => {
  /**
   * calculateKakuhenTimingsメソッドが2つの近くのタイミングを返し、境界を制限することをテストする。
   * 期待値: 0で[], 1で[1], 2で[1,2], 5で[2,3]。
   */
  it("calculateKakuhenTimings returns 2 nearby timings and bounds them", () => {
    const s = new PrizeReservationService(new MockRandom([0]) as any);
    expect(s.calculateKakuhenTimings(0)).toEqual([]);
    expect(s.calculateKakuhenTimings(1)).toEqual([1]);
    expect(s.calculateKakuhenTimings(2)).toEqual([1, 2]);
    expect(s.calculateKakuhenTimings(5)).toEqual([2, 3]);
  });

  /**
   * reservePrizesメソッドが正しい数を選択し、reservedCount >= prizes.lengthのときにエラーを投げることをテストする。
   * 期待値: 長さが2で、IDが重複しない。4でエラーが投げられる。
   */
  it("reservePrizes picks the correct number and throws when reservedCount >= prizes.length", () => {
    const rand = new MockRandom([0.0, 0.4, 0.6, 0.2]);
    const svc = new PrizeReservationService(rand as any);
    const prizes = [
      { id: "p1", rank: 10 },
      { id: "p2", rank: 5 },
      { id: "p3", rank: 1 },
      { id: "p4", rank: 2 },
    ];
    const res = svc.reservePrizes(2, prizes as any);
    expect(res.length).toBe(2);
    // should not duplicate ids
    expect(new Set(res.map((r) => r.id)).size).toBe(2);

    expect(() => svc.reservePrizes(4, prizes as any)).toThrow();
  });
});
