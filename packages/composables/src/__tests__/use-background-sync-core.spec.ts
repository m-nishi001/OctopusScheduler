import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { useBackgroundSyncCore } from "../use-background-sync-core";

describe("useBackgroundSyncCore: syncPulled", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 起動直後の同期(immediate)を1回流しきる。 */
  async function runInitialSync(syncAll: () => Promise<{ pulled?: number; failed: { error: string }[] }>) {
    const onPulled = vi.fn();
    eventBus.on("syncPulled", onPulled);
    const { cleanup } = useBackgroundSyncCore(syncAll);
    await vi.advanceTimersByTimeAsync(0);
    cleanup();
    eventBus.off("syncPulled", onPulled);
    return onPulled;
  }

  it("リモートから取り込みがあれば syncPulled を通知する(一覧の再読込のため)", async () => {
    const onPulled = await runInitialSync(async () => ({ pulled: 2, failed: [] }));
    expect(onPulled).toHaveBeenCalledTimes(1);
  });

  it("取り込みが無ければ通知しない", async () => {
    const onPulled = await runInitialSync(async () => ({ pulled: 0, failed: [] }));
    expect(onPulled).not.toHaveBeenCalled();
  });

  it("pulled を返さない同期結果でも通知しない", async () => {
    const onPulled = await runInitialSync(async () => ({ failed: [] }));
    expect(onPulled).not.toHaveBeenCalled();
  });

  it("一部失敗していても、取り込めた分があれば通知する", async () => {
    const onPulled = await runInitialSync(async () => ({ pulled: 1, failed: [{ error: "x" }] }));
    expect(onPulled).toHaveBeenCalledTimes(1);
  });
});

describe("useBackgroundSyncCore: 同期の重なり", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 解放するまで終わらない同期。呼び出し回数と同時実行数を数える。 */
  function makeBlockingSync() {
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const releases: Array<() => void> = [];
    const syncAll = async () => {
      calls++;
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
      return { failed: [] };
    };
    return {
      syncAll,
      stats: () => ({ calls, maxActive }),
      releaseOne: async () => {
        releases.shift()?.();
        await vi.advanceTimersByTimeAsync(0);
      },
    };
  }

  it("同期中に変更の通知が来ても同時には走らせず、終わったあとにもう1回だけ流す", async () => {
    const sync = makeBlockingSync();
    const { cleanup } = useBackgroundSyncCore(sync.syncAll);
    await vi.advanceTimersByTimeAsync(0); // 起動直後の同期が始まる
    expect(sync.stats()).toEqual({ calls: 1, maxActive: 1 });

    eventBus.emit("syncDirty");
    eventBus.emit("syncDirty");
    await vi.advanceTimersByTimeAsync(3000); // デバウンスが明ける(同期はまだ終わっていない)
    expect(sync.stats()).toEqual({ calls: 1, maxActive: 1 });

    await sync.releaseOne(); // 1回目が終わる → 待たせていた1回が始まる
    expect(sync.stats()).toEqual({ calls: 2, maxActive: 1 });

    await sync.releaseOne();
    await vi.advanceTimersByTimeAsync(0);
    expect(sync.stats()).toEqual({ calls: 2, maxActive: 1 }); // それ以上は流れない
    cleanup();
  });

  it("定期の同期が、実行中の同期に重ならない", async () => {
    const sync = makeBlockingSync();
    const { cleanup } = useBackgroundSyncCore(sync.syncAll);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(61_000); // 1回目が終わらないまま、定期の時刻になる
    expect(sync.stats().maxActive).toBe(1);
    cleanup();
  });

  it("失敗しても次の同期は流れる(実行中の印が残らない)", async () => {
    let calls = 0;
    const { cleanup } = useBackgroundSyncCore(async () => {
      calls++;
      throw new Error("boom");
    });
    await vi.advanceTimersByTimeAsync(0);
    eventBus.emit("syncDirty");
    await vi.advanceTimersByTimeAsync(3000);
    expect(calls).toBe(2);
    cleanup();
  });
});
