import { describe, it, expect } from "vitest";
import { resolveSyncAction } from "../conflict-resolution";

describe("resolveSyncAction", () => {
  it("skips when neither side has data", () => {
    expect(resolveSyncAction(null, null)).toBe("skip");
  });

  it("pulls when only remote has data", () => {
    expect(resolveSyncAction(null, { updatedAt: 100 })).toBe("pull");
  });

  it("pushes when only local has data", () => {
    expect(resolveSyncAction({ updatedAt: 100 }, null)).toBe("push");
  });

  it("pushes when local is newer than remote", () => {
    expect(
      resolveSyncAction({ updatedAt: 200 }, { updatedAt: 100 })
    ).toBe("push");
  });

  it("pulls when remote is newer than local", () => {
    expect(
      resolveSyncAction({ updatedAt: 100 }, { updatedAt: 200 })
    ).toBe("pull");
  });

  it("skips when both sides have the same updatedAt", () => {
    expect(
      resolveSyncAction({ updatedAt: 100 }, { updatedAt: 100 })
    ).toBe("skip");
  });
});
