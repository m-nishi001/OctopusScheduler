import { describe, it, expect } from "vitest";
import { crossedHalf } from "./half-remaining";

/** 全体 total 個を1個ずつ引いたとき、「あと半分」が出る回(1始まり)の一覧。 */
const halfTurns = (total: number, drawable = total) =>
  Array.from({ length: drawable }, (_, i) => i + 1).filter((turn) => crossedHalf({ total, before: total - (turn - 1), after: total - turn }));

describe("crossedHalf(残りが全体の半分以下になった最初の回)", () => {
  it("偶数(10個): 残り5個になった回(5回目)に1度だけ", () => {
    expect(halfTurns(10)).toEqual([5]);
  });

  it("奇数(7個): 残り3個(半分以下になった最初)の回(4回目)に1度だけ", () => {
    expect(halfTurns(7)).toEqual([4]);
  });

  it("対象外の景品があっても、全体は対象の景品だけで数える(対象6個 → 3回目)", () => {
    // 景品は7個あるが対象外が1個。total は当選対象の6個
    expect(halfTurns(6)).toEqual([3]);
  });

  it("最後の1個(残り0)では出ない。景品が1個・2個でも壊れない", () => {
    expect(crossedHalf({ total: 1, before: 1, after: 0 })).toBe(false);
    expect(halfTurns(1)).toEqual([]);
    expect(halfTurns(2)).toEqual([1]);
    expect(halfTurns(3)).toEqual([2]);
  });

  it("すでに半分以下から始まる(再開など)と、半分を超えた回がないので出ない", () => {
    expect(crossedHalf({ total: 10, before: 4, after: 3 })).toBe(false);
  });
});
