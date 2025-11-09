import { describe, it, expect } from "vitest";
import {
  calculateSectorAngle,
  calculateTargetRotation,
  calculateTotalRotation,
  calculateAcceleratedRotation,
  calculateDeceleratedRotationCalc,
} from "../roulette-angle-utils";

describe("calculateSectorAngle", () => {
  it("should calculate sector angle for 8 sectors", () => {
    const result = calculateSectorAngle(8);
    expect(result).toBe(Math.PI / 4);
  });

  it("should calculate sector angle for more than 8 sectors", () => {
    const result = calculateSectorAngle(10);
    expect(result).toBe((Math.PI * 2) / 10);
  });

  it("should use minimum 8 sectors even if less provided", () => {
    const result = calculateSectorAngle(5);
    expect(result).toBe(Math.PI / 4);
  });
});

describe("calculateTargetRotation", () => {
  it("should calculate target rotation for given index and sector angle", () => {
    const sectorAngle = Math.PI / 4;
    const result = calculateTargetRotation(0, sectorAngle);
    expect(result).toBeGreaterThan(Math.PI / 2);
    expect(result).toBeLessThan(Math.PI / 2 + sectorAngle);
  });
});

describe("calculateTotalRotation", () => {
  it("should calculate total rotation including minimum rotations", () => {
    const result = calculateTotalRotation(0, Math.PI, 1, 1);
    expect(result).toBeGreaterThan(Math.PI);
  });
});

describe("calculateAcceleratedRotation", () => {
  it("should return accelerated speed and delta rotation", () => {
    const result = calculateAcceleratedRotation(0.5, 1, 2);
    expect(result.acceleratedSpeed).toBe(1);
    expect(result.deltaRotation).toBeCloseTo(1.0001, 4);
  });
});

describe("calculateDeceleratedRotationCalc", () => {
  it("should calculate rotation and speed for deceleration", () => {
    const result = calculateDeceleratedRotationCalc(10, 1, 2, 500, 0);
    expect(result.rotation).toBeGreaterThan(0);
    expect(result.speed).toBeLessThan(2);
  });
});
