import { describe, it, expect } from "vitest";
import { CloudflareConcurrencyPolicy } from "../cloudflare-concurrency-policy";

describe("CloudflareConcurrencyPolicy", () => {
  it("returns a high concurrency ceiling regardless of kind, since fetch has no GAS-style limit", () => {
    const policy = new CloudflareConcurrencyPolicy();
    expect(policy.maxConcurrency("asset")).toBe(32);
    expect(policy.maxConcurrency("members")).toBe(32);
  });
});
