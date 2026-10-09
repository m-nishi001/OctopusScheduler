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
