import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { SyncService } from "../../control/sync/sync-service";
import { startBackgroundSync, stopBackgroundSync, useBackgroundSync } from "./use-background-sync";

afterEach(() => {
  stopBackgroundSync();
  container.clearInstances();
  vi.useRealTimers();
});

describe("アプリ全体の同期(startBackgroundSync / useBackgroundSync)", () => {
  it("何度始めても同期は1つ。読む画面(設定画面など)が外れても止まらず、stopBackgroundSync で止まる", async () => {
    vi.useFakeTimers();
    const syncAll = vi.fn(async () => ({ results: [] }));
    container.registerInstance(SyncService, { syncAll } as never);

    startBackgroundSync();
    startBackgroundSync();
    await vi.advanceTimersByTimeAsync(0);
    expect(syncAll).toHaveBeenCalledTimes(1);

    let state: ReturnType<typeof useBackgroundSync> | undefined;
    const Screen = defineComponent({ setup() { state = useBackgroundSync(); return () => h("div"); } });
    const first = mount(Screen);
    expect(state).toBe(useBackgroundSync());
    first.unmount();
    await vi.advanceTimersByTimeAsync(61_000);
    expect(syncAll).toHaveBeenCalledTimes(2); // 画面が無くても、定期の同期は続く

    stopBackgroundSync();
    await vi.advanceTimersByTimeAsync(130_000);
    expect(syncAll).toHaveBeenCalledTimes(2);
  });

  it("始まっていなければ、読む画面は空の状態を得る(画面の中で同期を始めない)", async () => {
    vi.useFakeTimers();
    const syncAll = vi.fn(async () => ({ results: [] }));
    container.registerInstance(SyncService, { syncAll } as never);
    const state = useBackgroundSync();
    await vi.advanceTimersByTimeAsync(130_000);
    expect(state.status.value).toBe("idle");
    expect(syncAll).not.toHaveBeenCalled();
  });
});
