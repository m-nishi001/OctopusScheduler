import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { useBackgroundSyncCore } from "../use-background-sync-core";
import type { SyncResultEntry, SyncSummary } from "../use-background-sync-core";

const ok = (result: SyncResultEntry["result"], id = "screens", kind = id): SyncResultEntry => ({ id, kind, result });
const failed = (id: string, action: SyncResultEntry["action"], error: string): SyncResultEntry => ({ id, kind: id, result: "failed", action, error });

describe("useBackgroundSyncCore: syncPulled", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** 起動直後の同期(immediate)を1回流しきる。 */
  async function runInitialSync(syncAll: () => Promise<SyncSummary>) {
    const onPulled = vi.fn();
    eventBus.on("syncPulled", onPulled);
    const { cleanup } = useBackgroundSyncCore(syncAll);
    await vi.advanceTimersByTimeAsync(0);
    cleanup();
    eventBus.off("syncPulled", onPulled);
    return onPulled;
  }

  it("リモートから取り込みがあれば syncPulled を通知する(一覧の再読込のため)", async () => {
    const onPulled = await runInitialSync(async () => ({ results: [ok("pulled"), ok("pulled", "prizes"), ok("pushed", "member-extras")] }));
    expect(onPulled).toHaveBeenCalledTimes(1);
  });

  it("取り込みが無ければ通知しない", async () => {
    const onPulled = await runInitialSync(async () => ({ results: [ok("pushed"), ok("skipped", "prizes")] }));
    expect(onPulled).not.toHaveBeenCalled();
  });

  it("結果が空でも通知しない", async () => {
    const onPulled = await runInitialSync(async () => ({ results: [] }));
    expect(onPulled).not.toHaveBeenCalled();
  });

  it("一部失敗していても、取り込めた分があれば通知する", async () => {
    const onPulled = await runInitialSync(async () => ({ results: [ok("pulled"), failed("prizes", "push", "x")] }));
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
      return { results: [] };
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

describe("useBackgroundSyncCore: 状態と同期ログ", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function runOnce(syncAll: () => Promise<SyncSummary>) {
    const sync = useBackgroundSyncCore(syncAll);
    await vi.advanceTimersByTimeAsync(0);
    sync.cleanup();
    return sync;
  }

  it("失敗が1件でもあれば error にして、件数と最初の理由を出す", async () => {
    const { status, lastError } = await runOnce(async () => ({ results: [ok("pushed"), failed("prizes", "push", "HTTP 500: boom"), failed("asset", "pull", "x")] }));
    expect(status.value).toBe("error");
    expect(lastError.value).toBe("2件の同期に失敗しました: HTTP 500: boom");
  });

  it("失敗が無ければ idle で、エラーは空", async () => {
    const { status, lastError } = await runOnce(async () => ({ results: [ok("skipped")] }));
    expect(status.value).toBe("idle");
    expect(lastError.value).toBeNull();
  });

  it("失敗と、他の端末の変更の反映だけをログに残す(送信の成功と skip は残さない)。新しいものが先頭", async () => {
    const { log } = await runOnce(async () => ({
      results: [ok("pushed", "prizes"), ok("skipped", "member-extras"), ok("pulled", "screens"), failed("asset", "push", "boom"), failed("quizzes", "pull", "bad"), failed("prizes", undefined, "net")],
    }));
    expect(log.value.map((e) => [e.kind, e.event, e.error])).toEqual([
      ["prizes", "syncFailed", "net"],
      ["quizzes", "pullFailed", "bad"],
      ["asset", "pushFailed", "boom"],
      ["screens", "pulledFromOther", undefined],
    ]);
    expect(log.value.every((e) => e.at > 0)).toBe(true);
  });

  it("同期の呼び出し自体が失敗したときも、理由つきでログに残す", async () => {
    const { log, status } = await runOnce(async () => {
      throw new Error("offline");
    });
    expect(status.value).toBe("error");
    expect(log.value).toMatchObject([{ kind: "sync", event: "syncFailed", error: "offline" }]);
  });

  it("同じ失敗が続いても1行にまとめる(他の端末の反映は毎回残す)", async () => {
    let n = 0;
    const sync = useBackgroundSyncCore(async () => ({ results: [failed("prizes", "push", "same"), ok("pulled", `s${n++}`, "screens")] }));
    await vi.advanceTimersByTimeAsync(0);
    eventBus.emit("syncDirty");
    await vi.advanceTimersByTimeAsync(3000);
    sync.cleanup();
    expect(sync.log.value.filter((e) => e.event === "pushFailed")).toHaveLength(1);
    expect(sync.log.value.filter((e) => e.event === "pulledFromOther")).toHaveLength(2);
  });

  it("ログは最大50件まで", async () => {
    const results = Array.from({ length: 70 }, (_, i) => failed(`t${i}`, "push", "e"));
    const { log } = await runOnce(async () => ({ results }));
    expect(log.value).toHaveLength(50);
  });
});
