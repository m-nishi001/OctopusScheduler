import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as service from "../../../server/engine/session-service";
import { MemoryDeviceStore } from "../device-store";
import { makeDevice, makeHub, tick } from "./harness";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

async function publishedSession() {
  const hub = makeHub();
  const meta = await service.createSession(hub.deps, { name: "受付会場" }, "admin1");
  await service.setPortalSession(hub.deps, { sessionId: meta.id, published: true });
  return { hub, meta };
}

describe("SessionConnection.joinPortal", () => {
  it("ログイン中のメンバーとして、参加コード無しでポータル公開中のセッションに入る", async () => {
    const { hub, meta } = await publishedSession();
    const alice = makeDevice(hub, { memberId: "alice", memberName: "アリス" });
    const result = await alice.conn.joinPortal();
    expect(result.session.id).toBe(meta.id);
    expect(alice.conn.state).toMatchObject({ phase: "connected", role: "client", code: meta.code });
    expect(await hub.deps.repoFor(meta.id).getDevice(result.deviceId)).toMatchObject({ memberId: "alice", label: "アリス" });
    alice.conn.dispose();
  });

  it("入室すると、ホストが公開した状態を受け取れる", async () => {
    const { hub, meta } = await publishedSession();
    const host = await service.joinOperator(hub.deps, { sessionId: meta.id, role: "host", label: "PC" }, "admin1");
    await service.publishState(hub.deps, {
      sessionId: meta.id,
      deviceId: host.deviceId,
      token: host.token,
      data: { event: { title: "ジャックポット" } },
    });
    const alice = makeDevice(hub, { memberId: "alice", memberName: "アリス" });
    await alice.conn.joinPortal();
    await tick(5000);
    expect(alice.conn.state.roomState?.data).toEqual({ event: { title: "ジャックポット" } });
    alice.conn.dispose();
  });

  it("公開中のセッションが無ければ入れず、SESSION_NOT_FOUND として扱える", async () => {
    const hub = makeHub();
    const alice = makeDevice(hub, { memberId: "alice", memberName: "アリス" });
    await expect(alice.conn.joinPortal()).rejects.toThrow();
    expect(alice.conn.state).toMatchObject({ phase: "idle", lastErrorCode: "SESSION_NOT_FOUND" });
  });

  it("未ログイン(メンバー不明)では入れない", async () => {
    const { hub } = await publishedSession();
    const anon = makeDevice(hub, { memberId: null });
    await expect(anon.conn.joinPortal()).rejects.toThrow(/Unauthorized/);
    expect(anon.conn.state.phase).toBe("idle");
  });

  it("リロードしても同じ端末として復帰する(保存した入室情報を使う)", async () => {
    const { hub } = await publishedSession();
    const store = new MemoryDeviceStore();
    const first = makeDevice(hub, { memberId: "alice", memberName: "アリス", store });
    const joined = await first.conn.joinPortal();
    first.conn.dispose();

    const reloaded = makeDevice(hub, { memberId: "alice", memberName: "アリス", store });
    const again = await reloaded.conn.joinPortal();
    expect(again.deviceId).toBe(joined.deviceId);
    reloaded.conn.dispose();
  });

  it("同じ端末で別の人がログインし直しても、前の人の端末には復帰せず自分の端末になる", async () => {
    const { hub, meta } = await publishedSession();
    const store = new MemoryDeviceStore();
    const alice = makeDevice(hub, { memberId: "alice", memberName: "アリス", store });
    const aliceJoin = await alice.conn.joinPortal();
    alice.conn.dispose();

    const bob = makeDevice(hub, { memberId: "bob", memberName: "ボブ", store });
    const bobJoin = await bob.conn.joinPortal();
    expect(bobJoin.deviceId).not.toBe(aliceJoin.deviceId);
    expect(await hub.deps.repoFor(meta.id).getDevice(bobJoin.deviceId)).toMatchObject({ memberId: "bob", label: "ボブ" });
    bob.conn.dispose();
  });

  it("退室すると保存した入室情報が消え、次は新しい端末になる", async () => {
    const { hub } = await publishedSession();
    const store = new MemoryDeviceStore();
    const first = makeDevice(hub, { memberId: "alice", memberName: "アリス", store });
    const joined = await first.conn.joinPortal();
    first.conn.leave();

    const next = makeDevice(hub, { memberId: "alice", memberName: "アリス", store });
    const again = await next.conn.joinPortal();
    expect(again.deviceId).not.toBe(joined.deviceId);
    next.conn.dispose();
  });
});
