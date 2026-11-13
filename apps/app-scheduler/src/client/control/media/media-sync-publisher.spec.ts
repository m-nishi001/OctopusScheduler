import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { registerMediaSyncPublisher } from "./media-sync-publisher";
import type { MediaSyncDeps } from "./media-sync-publisher";
import type { CatalogItem, HostMediaSlice } from "@model/media/media-catalog";

const item = (id: string): CatalogItem => ({ id, name: `${id}.png`, kind: "image", folder: "" });
const flush = () => new Promise((r) => setTimeout(r, 0));

/** HostAgent の代わり。接続の状態を変えて入室を再現し、公開された `media` を記録する。 */
function fakeAgent() {
  const listeners = new Set<(s: { phase: string; role: string }) => void>();
  const published: HostMediaSlice[] = [];
  const agent = {
    active: true,
    connection: { subscribe: (l: (s: { phase: string; role: string }) => void) => (listeners.add(l), () => listeners.delete(l)) },
    publishSlice: vi.fn(async (ns: string, data: unknown) => {
      expect(ns).toBe("media");
      published.push(data as HostMediaSlice);
    }),
  };
  const join = () => listeners.forEach((l) => l({ phase: "connected", role: "host" }));
  const leave = () => listeners.forEach((l) => l({ phase: "idle", role: "host" }));
  return { agent: agent as never, published, join, leave, listeners };
}

function fakeDeps(local: CatalogItem[], remote: CatalogItem[]) {
  const state = { local, remote, now: 1_700_000_000_000, remoteFails: false };
  const deps: MediaSyncDeps = {
    readLocal: async () => state.local,
    readRemote: async () => {
      if (state.remoteFails) throw new Error("offline");
      return state.remote;
    },
    now: () => state.now,
  };
  return { state, deps };
}

let disposers: (() => void)[] = [];
const register = (...args: Parameters<typeof registerMediaSyncPublisher>) => {
  const publisher = registerMediaSyncPublisher(...args);
  disposers.push(publisher.dispose);
  return publisher;
};
beforeEach(() => {
  disposers = [];
});
afterEach(() => disposers.forEach((d) => d()));

describe("registerMediaSyncPublisher(ホスト)", () => {
  it("ホストとして入室したら、差が無くても必ず公開する。番号は入室時の時刻から始まる", async () => {
    const { agent, published, join } = fakeAgent();
    const { deps, state } = fakeDeps([item("a")], [item("a")]);
    register(agent, deps);
    join();
    await flush();
    expect(published).toEqual([{ rev: state.now + 1, pending: [], removedIds: [], truncated: 0 }]);
  });

  it("入室の前や、ホストでない接続の状態では公開しない。入室のたびに公開し直す", async () => {
    const { agent, published, join, leave } = fakeAgent();
    register(agent, fakeDeps([], []).deps);
    leave();
    await flush();
    expect(published).toHaveLength(0);
    join();
    await flush();
    join(); // 接続したまま、同じ状態が重ねて来ても公開し直さない
    await flush();
    leave();
    join();
    await flush();
    expect(published).toHaveLength(2);
  });

  it("ホストが替わると、新しいホストの公開が、前のホストのアップロード前の素材を上書きする", async () => {
    // 前のホスト: A はまだサーバーに無い。新しいホスト: A を持たない
    const oldHost = fakeAgent();
    register(oldHost.agent, fakeDeps([item("a"), item("up")], [item("up")]).deps);
    oldHost.join();
    await flush();
    expect(oldHost.published.at(-1)!.pending.map((i) => i.id)).toEqual(["a"]);

    const newHost = fakeAgent();
    register(newHost.agent, fakeDeps([item("up")], [item("up")]).deps);
    newHost.join();
    await flush();
    expect(newHost.published).toHaveLength(1);
    expect(newHost.published[0].pending).toEqual([]);
  });

  it("素材の追加・削除(assets:updated)で、アップロード前の素材を公開し、番号を進める", async () => {
    const { agent, published, join } = fakeAgent();
    const { deps, state } = fakeDeps([], []);
    register(agent, deps);
    join();
    await flush();
    state.local = [item("new")];
    window.dispatchEvent(new CustomEvent("assets:updated", { detail: { added: ["new"] } }));
    await flush();
    expect(published.at(-1)).toMatchObject({ pending: [item("new")] });
    expect(published.at(-1)!.rev).toBe(published[0].rev + 1);
  });

  it("同期が終わって(syncDone)サーバーに載ったら pending は空になり、番号が進む(管理端末は一覧を読み直す)", async () => {
    const { agent, published, join } = fakeAgent();
    const { deps, state } = fakeDeps([item("new")], []);
    register(agent, deps);
    join();
    await flush();
    expect(published.at(-1)!.pending).toHaveLength(1);
    state.remote = [item("new")];
    eventBus.emit("syncDone");
    await flush();
    expect(published.at(-1)!.pending).toEqual([]);
    expect(published.at(-1)!.rev).toBe(published[0].rev + 1);
  });

  it("入室直後(最初の同期の前)は、サーバーにだけある素材を、ホストが消したことにしない。同期のあとにホストで消した素材は removedIds に載せる", async () => {
    const { agent, published, join } = fakeAgent();
    const { deps, state } = fakeDeps([], [item("keep"), item("gone")]);
    register(agent, deps);
    join();
    await flush();
    expect(published.at(-1)!.removedIds).toEqual([]); // ホストはまだ何も取り込んでいない

    state.local = [item("keep"), item("gone")]; // 同期で取り込んだ(ホストとサーバーが揃う)
    eventBus.emit("syncDone");
    await flush();
    expect(published.at(-1)!.removedIds).toEqual([]);

    state.local = [item("keep")]; // ホストで消した(まだサーバーに残っている)
    window.dispatchEvent(new CustomEvent("assets:updated", { detail: { deleted: ["gone"] } }));
    await flush();
    expect(published.at(-1)!.removedIds).toEqual(["gone"]);

    state.remote = [item("keep"), item("other-device")]; // 消した分の同期が済み、別の端末が足した素材もある
    eventBus.emit("syncDone");
    await flush();
    expect(published.at(-1)!.removedIds).toEqual([]);
  });

  it("再生の失敗(reportFailure)は lastError として、以後の公開に載せる", async () => {
    const { agent, published, join } = fakeAgent();
    const { deps, state } = fakeDeps([], []);
    const publisher = register(agent, deps);
    join();
    await flush();
    state.now += 5000;
    publisher.reportFailure("missing1");
    await flush();
    expect(published.at(-1)!.lastError).toEqual({ assetId: "missing1", at: state.now });
    eventBus.emit("syncDone");
    await flush();
    expect(published.at(-1)!.lastError).toEqual({ assetId: "missing1", at: state.now });
  });

  it("サーバーの一覧を読めなくても公開する(ホストにある素材は、アップロード前として載せる)", async () => {
    const { agent, published, join } = fakeAgent();
    const { deps, state } = fakeDeps([item("a")], []);
    state.remoteFails = true;
    register(agent, deps);
    join();
    await flush();
    expect(published.at(-1)!.pending).toEqual([item("a")]);
  });

  it("ホストの一覧を読めなければ公開しない(警告だけ)。ホストとして接続していなければ何もしない", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { agent, published, join } = fakeAgent();
    const deps: MediaSyncDeps = { readLocal: async () => Promise.reject(new Error("db")), readRemote: async () => [], now: () => 1 };
    register(agent, deps);
    join();
    await flush();
    expect(published).toHaveLength(0);

    const inactive = fakeAgent();
    (inactive.agent as { active: boolean }).active = false;
    register(inactive.agent, fakeDeps([], []).deps);
    inactive.join();
    await flush();
    expect(inactive.published).toHaveLength(0);
  });

  it("公開の途中に続けて起きた変更は、まとめて最新の一覧で1回だけ公開し直す", async () => {
    const { agent, published, join } = fakeAgent();
    const { deps, state } = fakeDeps([], []);
    let gate: () => void = () => undefined;
    let blocked = false;
    const slow: MediaSyncDeps = {
      ...deps,
      readLocal: async () => {
        const snapshot = state.local;
        if (blocked) await new Promise<void>((r) => (gate = r));
        return snapshot;
      },
    };
    register(agent, slow);
    join();
    await flush();
    blocked = true;
    state.local = [item("a")];
    eventBus.emit("syncDone"); // 1回目(止まる)
    await flush();
    state.local = [item("a"), item("b")];
    eventBus.emit("syncDone");
    eventBus.emit("syncDone"); // 2・3回目は、いまの公開が終わるのを待つ
    blocked = false;
    gate();
    await flush();
    await flush();
    expect(published.map((s) => s.pending.length)).toEqual([0, 1, 2]);
  });

  it("dispose で、入室・assets:updated・syncDone の購読を外す", async () => {
    const { agent, published, join, listeners } = fakeAgent();
    const publisher = registerMediaSyncPublisher(agent, fakeDeps([], []).deps);
    publisher.dispose();
    expect(listeners.size).toBe(0);
    join();
    window.dispatchEvent(new CustomEvent("assets:updated"));
    eventBus.emit("syncDone");
    await flush();
    expect(published).toHaveLength(0);
  });
});
