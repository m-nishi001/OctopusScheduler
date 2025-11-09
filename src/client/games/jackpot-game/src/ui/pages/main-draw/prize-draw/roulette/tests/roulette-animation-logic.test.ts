import { describe, it, expect, vi } from "vitest";
import { calculateTargetRotation } from "../roulette-animator";

describe("calculateTargetRotation", () => {
  it("should calculate target rotation correctly", () => {
    // Mock Math.random to return 0.5 (center of offset range)
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const finalPrizeIndex = 2;
    const sectorAngle = Math.PI / 4; // 45 degrees

    const result = calculateTargetRotation(finalPrizeIndex, sectorAngle);

    // sectorCenter = sectorAngle / 2 = Math.PI / 8
    // randomOffset = (0.5 - 0.5) * sectorCenter = 0
    // offset = sectorCenter + randomOffset = Math.PI / 8
    // prizeAngle = 2 * (Math.PI / 4) = Math.PI / 2
    // adjustedAngle = prizeAngle + offset = Math.PI / 2 + Math.PI / 8 = 5Math.PI / 8
    // targetRotation = adjustedAngle + Math.PI / 2 = 5Math.PI / 8 + Math.PI / 2 = 9Math.PI / 8

    expect(result).toBeCloseTo((9 * Math.PI) / 8);

    // Restore Math.random
    vi.restoreAllMocks();
  });

  it("should handle different random values", () => {
    // Mock Math.random to return 0 (min offset)
    vi.spyOn(Math, "random").mockReturnValue(0);

    const finalPrizeIndex = 0;
    const sectorAngle = Math.PI / 2;

    const result = calculateTargetRotation(finalPrizeIndex, sectorAngle);

    // sectorCenter = Math.PI / 4
    // randomOffset = (0 - 0.5) * Math.PI / 4 = -Math.PI / 8
    // offset = Math.PI / 4 + (-Math.PI / 8) = Math.PI / 8
    // prizeAngle = 0
    // adjustedAngle = 0 + Math.PI / 8 = Math.PI / 8
    // targetRotation = Math.PI / 8 + Math.PI / 2 = 5Math.PI / 8

    expect(result).toBeCloseTo((5 * Math.PI) / 8);

    vi.restoreAllMocks();
  });
});
