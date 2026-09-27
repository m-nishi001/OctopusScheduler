import { describe, it, expect } from "vitest";
import { DirtyTracker } from "../dirty-tracker";

describe("DirtyTracker", () => {
  it("returns null for a kind that has never been touched", async () => {
    const tracker = new DirtyTracker(`dirty-tracker-test-${crypto.randomUUID()}`);
    expect(await tracker.getUpdatedAt("members")).toBeNull();
  });

  it("records the current time when touched, and returns it afterwards", async () => {
    const tracker = new DirtyTracker(`dirty-tracker-test-${crypto.randomUUID()}`);
    const before = Date.now();
    const touchedAt = await tracker.touch("members");
    const after = Date.now();

    expect(touchedAt).toBeGreaterThanOrEqual(before);
    expect(touchedAt).toBeLessThanOrEqual(after);
    expect(await tracker.getUpdatedAt("members")).toBe(touchedAt);
  });

  it("tracks each kind independently", async () => {
    const tracker = new DirtyTracker(`dirty-tracker-test-${crypto.randomUUID()}`);
    const membersAt = await tracker.touch("members");
    const prizesAt = await tracker.touch("prizes");

    expect(await tracker.getUpdatedAt("members")).toBe(membersAt);
    expect(await tracker.getUpdatedAt("prizes")).toBe(prizesAt);
  });
});
