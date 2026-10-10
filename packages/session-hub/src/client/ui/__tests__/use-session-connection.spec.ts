import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import * as service from "../../../server/engine/session-service";
import { makeDevice, makeHub, tick } from "../../model/__tests__/harness";
import { useSessionConnection } from "../use-session-connection";
import type { VisibilitySource } from "../use-session-connection";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

function fakeVisibility(initial = true) {
  let visible = initial;
  const listeners = new Set<() => void>();
  const source: VisibilitySource = {
    isVisible: () => visible,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return {
    source,
    set(v: boolean) {
      visible = v;
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
}

describe("useSessionConnection", () => {
  it("接続状態の変化をリアクティブな参照へ反映する", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const dev = makeDevice(hub);
    const scope = effectScope();
    const { state } = scope.run(() => useSessionConnection(dev.conn, fakeVisibility().source))!;
    expect(state.value.phase).toBe("idle");
    await dev.conn.joinClient({ code: meta.code });
    expect(state.value.phase).toBe("connected");
    await tick(4000);
    expect(state.value.presence?.clientCount).toBe(1);
    scope.stop();
  });

  it("スコープ破棄で購読を解除し、接続(ポーリング)を止める", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const dev = makeDevice(hub);
    const vis = fakeVisibility();
    const scope = effectScope();
    scope.run(() => useSessionConnection(dev.conn, vis.source));
    await dev.conn.joinClient({ code: meta.code });
    await tick(4000);
    expect(vis.listenerCount()).toBe(1);
    scope.stop();
    expect(vis.listenerCount()).toBe(0);
    const calls = dev.api.calls.poll;
    await tick(60_000);
    expect(dev.api.calls.poll).toBe(calls);
  });

  it("非表示で取得を減らし、表示に戻ると即座に取得する", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const dev = makeDevice(hub);
    const vis = fakeVisibility();
    const scope = effectScope();
    scope.run(() => useSessionConnection(dev.conn, vis.source));
    await dev.conn.joinClient({ code: meta.code });
    await tick(5000);
    vis.set(false);
    const hidden = dev.api.calls.poll;
    await tick(60_000);
    expect(dev.api.calls.poll - hidden).toBeLessThanOrEqual(3);
    const before = dev.api.calls.poll;
    vis.set(true);
    await tick(1);
    expect(dev.api.calls.poll).toBe(before + 1);
    scope.stop();
  });
});
