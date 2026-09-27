import { describe, it, expect } from "vitest";
import { GasConcurrencyPolicy } from "../gas-concurrency-policy";

describe("GasConcurrencyPolicy", () => {
  it("caps asset-like kinds at 6, matching the existing tuned AssetRepository concurrency", () => {
    const policy = new GasConcurrencyPolicy();
    expect(policy.maxConcurrency("asset")).toBe(6);
    expect(policy.maxConcurrency("quiz-asset")).toBe(6);
  });

  it("falls back to a conservative default for other kinds", () => {
    const policy = new GasConcurrencyPolicy();
    expect(policy.maxConcurrency("members")).toBe(4);
    expect(policy.maxConcurrency("unknown-kind")).toBe(4);
  });
});
