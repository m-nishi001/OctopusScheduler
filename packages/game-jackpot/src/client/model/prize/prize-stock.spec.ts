import { describe, expect, it } from "vitest";
import { prizeStock, remainingPrizeCount } from "./prize-stock";

const prizes = [{ id: "a" }, { id: "b" }, { id: "dummy", drawable: false }];

describe("prizeStock", () => {
  it("当選対象は、当たる前は残り1、当たった後は0", () => {
    expect(prizeStock(prizes[0], [])).toEqual({ wins: 0, remaining: 1 });
    expect(prizeStock(prizes[0], ["a"])).toEqual({ wins: 1, remaining: 0 });
  });
  it("当選対象でない景品は、残りに数えない(null)", () => {
    expect(prizeStock(prizes[2], [])).toEqual({ wins: 0, remaining: null });
  });
});

describe("remainingPrizeCount", () => {
  it("当選対象でない景品は数えない", () => {
    expect(remainingPrizeCount(prizes, [])).toBe(2);
    expect(remainingPrizeCount(prizes, ["a"])).toBe(1);
  });
  it("全景品を引き切ったら0(当選対象でない景品が残っていても)", () => {
    expect(remainingPrizeCount(prizes, ["a", "b"])).toBe(0);
  });
});
