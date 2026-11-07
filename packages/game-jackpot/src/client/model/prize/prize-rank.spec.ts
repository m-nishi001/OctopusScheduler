import { describe, expect, it } from "vitest";
import { DEFAULT_PRIZE_RANK, MAX_PRIZE_RANK, MIN_PRIZE_RANK, prizeRankToWeight, resolvePrizeRank } from "./prize-rank";

describe("prizeRankToWeight", () => {
  it("ランク5(豪華)が重み1で最もレア、ランク1が重み5", () => {
    expect([1, 2, 3, 4, 5].map(prizeRankToWeight)).toEqual([5, 4, 3, 2, 1]);
  });

  it("未設定は既定ランク3(重み3)", () => {
    expect(DEFAULT_PRIZE_RANK).toBe(3);
    expect(prizeRankToWeight(undefined)).toBe(3);
  });

  it("範囲外・不正値は1〜5にそろえる", () => {
    expect(resolvePrizeRank(0)).toBe(MIN_PRIZE_RANK);
    expect(resolvePrizeRank(99)).toBe(MAX_PRIZE_RANK);
    expect(resolvePrizeRank(NaN)).toBe(DEFAULT_PRIZE_RANK);
    expect(resolvePrizeRank(2.9)).toBe(2);
  });
});