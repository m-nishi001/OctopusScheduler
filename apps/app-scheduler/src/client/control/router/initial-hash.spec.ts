import { describe, it, expect } from "vitest";
import { hashToPath } from "./initial-hash";

describe("hashToPath", () => {
  it("converts the hash of the QR code URL into a router path", () => {
    expect(hashToPath("/quiz/abc/join")).toBe("/quiz/abc/join");
    expect(hashToPath("#/quiz/abc/join")).toBe("/quiz/abc/join");
    expect(hashToPath("quiz/abc/join")).toBe("/quiz/abc/join");
  });

  it("returns null when there is no hash", () => {
    expect(hashToPath("")).toBeNull();
    expect(hashToPath("#")).toBeNull();
    expect(hashToPath("/")).toBeNull();
    expect(hashToPath(undefined)).toBeNull();
  });
});
