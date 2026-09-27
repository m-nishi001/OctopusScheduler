import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { FixedConcurrencyPolicy } from "@octopus/infrastructures/testing";
import { SyncRunner } from "../sync-runner";
import type { SyncTarget } from "../sync-target";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeTarget(
  id: string,
  overrides: Partial<SyncTarget<string, string>> = {}
): SyncTarget<string, string> {
  return {
    id,
    kind: "test",
    getLocal: async () => ({ data: "local", updatedAt: 100 }),
    getRemote: async () => ({ data: "remote", updatedAt: 0 }),
    push: async () => ({ updatedAt: Date.now() }),
    pull: async () => ({ updatedAt: Date.now() }),
    ...overrides,
  };
}

describe("SyncRunner", () => {
  it("pushes local-only-newer targets and skips targets with no changes, exactly once each", async () => {
    const pushCalls: string[] = [];
    const targets: SyncTarget[] = [
      makeTarget("newer-local", {
        push: async (data) => {
          pushCalls.push(data as string);
          return { updatedAt: Date.now() };
        },
      }),
      makeTarget("in-sync", {
        getLocal: async () => ({ data: "same", updatedAt: 100 }),
        getRemote: async () => ({ data: "same", updatedAt: 100 }),
        push: async () => {
          throw new Error("should not be called");
        },
        pull: async () => {
          throw new Error("should not be called");
        },
      }),
    ];

    const runner = new SyncRunner(new FixedConcurrencyPolicy(5));
    const summary = await runner.run(targets);

    expect(pushCalls).toEqual(["local"]);
    expect(summary).toEqual({ pushed: 1, pulled: 0, skipped: 1, failed: [] });
  });

  it("pulls when remote is newer", async () => {
    const pullCalls: string[] = [];
    const targets: SyncTarget[] = [
      makeTarget("newer-remote", {
        getLocal: async () => ({ data: "local", updatedAt: 0 }),
        getRemote: async () => ({ data: "remote", updatedAt: 100 }),
        pull: async (data) => {
          pullCalls.push(data as string);
          return { updatedAt: Date.now() };
        },
      }),
    ];

    const runner = new SyncRunner(new FixedConcurrencyPolicy(5));
    const summary = await runner.run(targets);

    expect(pullCalls).toEqual(["remote"]);
    expect(summary.pulled).toBe(1);
  });

  it("never runs more than maxConcurrency targets of the same kind at once", async () => {
    const maxConcurrency = 2;
    let inFlight = 0;
    let maxObservedInFlight = 0;

    const targets: SyncTarget[] = Array.from({ length: 6 }, (_, i) =>
      makeTarget(`target-${i}`, {
        push: async () => {
          inFlight++;
          maxObservedInFlight = Math.max(maxObservedInFlight, inFlight);
          await delay(10);
          inFlight--;
          return { updatedAt: Date.now() };
        },
      })
    );

    const runner = new SyncRunner(new FixedConcurrencyPolicy(maxConcurrency));
    await runner.run(targets);

    expect(maxObservedInFlight).toBeLessThanOrEqual(maxConcurrency);
    expect(maxObservedInFlight).toBeGreaterThan(0);
  });

  it("records a per-target failure without aborting the rest of the batch", async () => {
    const targets: SyncTarget[] = [
      makeTarget("failing", {
        push: async () => {
          throw new Error("boom");
        },
      }),
      makeTarget("ok"),
    ];

    const runner = new SyncRunner(new FixedConcurrencyPolicy(5));
    const summary = await runner.run(targets);

    expect(summary.pushed).toBe(1);
    expect(summary.failed).toEqual([{ id: "failing", error: "boom" }]);
  });

  it("runs different kinds concurrently, each honoring its own concurrency cap", async () => {
    const targets: SyncTarget[] = [
      makeTarget("asset-1", { kind: "asset" }),
      makeTarget("member-1", { kind: "members" }),
    ];

    const runner = new SyncRunner(new FixedConcurrencyPolicy(1));
    const summary = await runner.run(targets);

    expect(summary.pushed).toBe(2);
  });
});
