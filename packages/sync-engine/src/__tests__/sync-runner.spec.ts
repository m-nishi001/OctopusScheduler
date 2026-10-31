import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { FixedConcurrencyPolicy } from "@octopus/infrastructures/testing";
import { SyncRunner, countResults } from "../sync-runner";
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
    push: async () => undefined,
    pull: async () => undefined,
    ...overrides,
  };
}

describe("SyncRunner", () => {
  it("pushes local-only-newer targets and skips targets with no changes, exactly once each", async () => {
    const pushCalls: string[] = [];
    const targets: SyncTarget[] = [
      makeTarget("newer-local", {
        push: async (snapshot) => {
          pushCalls.push(snapshot.data as string);
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
    expect(summary.results).toHaveLength(2);
    expect(summary.results).toContainEqual({ id: "newer-local", kind: "test", result: "pushed" });
    expect(summary.results).toContainEqual({ id: "in-sync", kind: "test", result: "skipped" });
  });

  it("pulls when remote is newer", async () => {
    const pullCalls: string[] = [];
    const targets: SyncTarget[] = [
      makeTarget("newer-remote", {
        getLocal: async () => ({ data: "local", updatedAt: 0 }),
        getRemote: async () => ({ data: "remote", updatedAt: 100 }),
        pull: async (remote, local) => {
          pullCalls.push(remote.data as string);
          expect(local).toEqual({ data: "local", updatedAt: 0 });
        },
      }),
    ];

    const runner = new SyncRunner(new FixedConcurrencyPolicy(5));
    const summary = await runner.run(targets);

    expect(pullCalls).toEqual(["remote"]);
    expect(countResults(summary, "pulled")).toBe(1);
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

    expect(countResults(summary, "pushed")).toBe(1);
    expect(summary.results).toContainEqual({ id: "failing", kind: "test", result: "failed", action: "push", error: "boom" });
  });

  it("runs different kinds concurrently, each honoring its own concurrency cap", async () => {
    const targets: SyncTarget[] = [
      makeTarget("asset-1", { kind: "asset" }),
      makeTarget("member-1", { kind: "members" }),
    ];

    const runner = new SyncRunner(new FixedConcurrencyPolicy(1));
    const summary = await runner.run(targets);

    expect(countResults(summary, "pushed")).toBe(2);
  });

  it("リモートの読み取りに失敗したら、向きが決まる前の失敗として理由をそのまま残す(ローカルを送らない)", async () => {
    let pushed = false;
    const targets: SyncTarget[] = [
      makeTarget("net", {
        getRemote: async () => {
          throw new Error("HTTP 500: server error");
        },
        push: async () => {
          pushed = true;
        },
      }),
    ];

    const summary = await new SyncRunner(new FixedConcurrencyPolicy(5)).run(targets);

    expect(pushed).toBe(false);
    expect(summary.results).toEqual([{ id: "net", kind: "test", result: "failed", action: undefined, error: "HTTP 500: server error" }]);
  });

  it("pull が false(判定のあとにローカルが編集されて書かなかった)なら、取り込みではなく skip として数える", async () => {
    const targets: SyncTarget[] = [
      makeTarget("edited", {
        getLocal: async () => ({ data: "local", updatedAt: 0 }),
        getRemote: async () => ({ data: "remote", updatedAt: 100 }),
        pull: async () => false,
      }),
    ];

    const summary = await new SyncRunner(new FixedConcurrencyPolicy(5)).run(targets);

    expect(summary.results).toEqual([{ id: "edited", kind: "test", result: "skipped" }]);
  });
});
