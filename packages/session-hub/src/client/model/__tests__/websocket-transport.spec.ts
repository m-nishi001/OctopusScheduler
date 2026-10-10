import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoom, WsBridge, createRoomApi, dateClock } from "../../../testing";
import type { FaultInjector, FakeHubApi } from "../../../testing";
import type { SessionMeta, Command } from "../../../shared/session-types";
import { MemoryDeviceStore } from "../device-store";
import { DEFAULT_POLLING_OPTIONS, PollingTransport, realTimers } from "../polling-transport";
import { SessionConnection } from "../session-connection";
import { DEFAULT_WS_OPTIONS, WebSocketTransport } from "../websocket-transport";
import type { WebSocketOptions } from "../websocket-transport";
import { tick } from "./harness";

const SID = "session-ws";
const noJitter = { ...realTimers, random: () => 0.5 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

function meta(): SessionMeta {
  return {
    id: SID,
    code: "WSCODE",
    name: "WS会場",
    ownerMemberId: "a",
    status: "lobby",
    mode: "live",
    createdAtMs: Date.now(),
    expiresAtMs: Date.now() + 12 * 3600 * 1000,
    hostDeviceId: null,
  };
}

async function setup() {
  const room = new FakeRoom(dateClock);
  await room.init(meta());
  const bridge = new WsBridge(room);
  return { room, bridge };
}

interface DeviceOpts {
  memberId?: string | null;
  faults?: FaultInjector;
  store?: MemoryDeviceStore;
  ws?: Partial<WebSocketOptions>;
  fallback?: boolean;
  maxCommandAgeMs?: number;
}

function makeWsDevice(room: FakeRoom, bridge: WsBridge, opts: DeviceOpts = {}) {
  const api: FakeHubApi = createRoomApi(room, opts.memberId ?? null, opts.faults);
  const fallback = opts.fallback === false ? undefined : new PollingTransport(api, noJitter, DEFAULT_POLLING_OPTIONS);
  const transport = new WebSocketTransport(
    {
      ...DEFAULT_WS_OPTIONS,
      url: (id) => `wss://example.test/ws/${id}`,
      createSocket: bridge.createSocket,
      fallback,
      ...opts.ws,
    },
    noJitter
  );
  const store = opts.store ?? new MemoryDeviceStore();
  let n = 0;
  const conn = new SessionConnection({
    api,
    store,
    transport,
    now: dateClock.now,
    newRequestId: () => `req-${++n}-${Math.random().toString(36).slice(2, 8)}`,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    maxCommandAgeMs: opts.maxCommandAgeMs,
  });
  return { api, transport, conn, store, fallback };
}

async function trio() {
  const { room, bridge } = await setup();
  const host = makeWsDevice(room, bridge, { memberId: "a" });
  const admin = makeWsDevice(room, bridge, { memberId: "b" });
  const client = makeWsDevice(room, bridge);
  const applied: Command[] = [];
  host.conn.onCommand((c) => void applied.push(c));
  await host.conn.joinOperator({ sessionId: SID, role: "host", label: "PC" });
  await admin.conn.joinOperator({ sessionId: SID, role: "admin", label: "A" });
  await client.conn.joinClient({ code: "WSCODE", label: "太郎" });
  await tick(100);
  return { room, bridge, host, admin, client, applied };
}

describe("WebSocketTransport: 基本動作", () => {
  it("接続後はポーリングせず、push で更新を受け取る", async () => {
    const { host, admin, client, bridge } = await trio();
    await tick(120_000);
    expect(host.api.calls.poll ?? 0).toBe(0);
    expect(admin.api.calls.poll ?? 0).toBe(0);
    expect(client.api.calls.poll ?? 0).toBe(0);
    expect(host.conn.state.phase).toBe("connected");
    expect(bridge.live).toHaveLength(3);
  });

  it("管理端末のコマンドは WebSocket 経由で発行され、ホストが順に1回ずつ適用する(RPC のコマンド発行は使わない)", async () => {
    const { admin, applied, room } = await trio();
    const rpcBefore = room.counts.rpc;
    await admin.conn.issue("jackpot", "advance");
    await admin.conn.issue("jackpot", "advance");
    await tick(100);
    expect(applied.map((c) => c.seq)).toEqual([1, 2]);
    expect(admin.api.calls.issueCommand ?? 0).toBe(0);
    expect(room.counts.rpc).toBe(rpcBefore);
  });

  it("コマンド発行の遅延は短い(次のポーリング間隔を待たない)", async () => {
    const { admin, applied } = await trio();
    await admin.conn.issue("jackpot", "advance");
    await tick(10);
    expect(applied).toHaveLength(1);
  });

  it("ホストは適用後に ack を送り、管理端末の在席に反映される", async () => {
    const { admin, room } = await trio();
    await admin.conn.issue("jackpot", "advance");
    await tick(100);
    expect(admin.conn.state.presence?.host?.ackSeq ?? 0).toBe(0);
    await room.runAlarm(); // 在席の変化はまとめて配信される(alarm)
    await tick(100);
    expect(admin.conn.state.presence?.host?.ackSeq).toBe(1);
    expect(admin.conn.state.headSeq).toBe(1);
  });

  it("状態の公開は参加者へ push される。公開(RPC)は課金上は少数で済む", async () => {
    const { host, client } = await trio();
    await host.conn.publish({ screen: "draw" }, ["jackpot.stopRoulette"]);
    await tick(100);
    expect(client.conn.state.roomState?.data).toEqual({ screen: "draw" });
    expect(client.conn.state.roomState?.clientInput).toEqual(["jackpot.stopRoulette"]);
  });

  it("参加者の許可入力は WebSocket で送られ、ホストに届く。許可外はそのまま拒否され再送されない", async () => {
    const { host, client, applied, room } = await trio();
    await expect(client.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);
    expect(client.api.calls.issueCommand ?? 0).toBe(0); // 業務エラーなので RPC にもフォールバックしない
    await host.conn.publish({}, ["jackpot.stopRoulette"]);
    await tick(100);
    const rpcBefore = room.counts.rpc;
    await client.conn.issue("jackpot", "stopRoulette");
    await tick(100);
    expect(applied.map((c) => c.type)).toEqual(["stopRoulette"]);
    expect(room.counts.rpc).toBe(rpcBefore);
  });

  it("同じ requestId の再送は重複しない(サーバ側の重複排除)", async () => {
    const { admin, applied } = await trio();
    await admin.conn.issue("jackpot", "advance");
    // 低レベルで同じ requestId を再送する
    const ws = (admin.transport as unknown as { ws: { send(d: string): void } }).ws;
    const sent = JSON.parse((ws as unknown as { sent?: string[] }).sent?.find((m) => m.includes('"issue"')) ?? "{}");
    if (sent.requestId) ws.send(JSON.stringify(sent));
    await tick(100);
    expect(applied).toHaveLength(1);
  });

  it("ホストのコマンド適用中に次の push が届いても、実行順は崩れない", async () => {
    const { room, bridge } = await setup();
    const host = makeWsDevice(room, bridge, { memberId: "a" });
    const admin = makeWsDevice(room, bridge, { memberId: "b" });
    const order: string[] = [];
    host.conn.onCommand(async (c) => {
      order.push(`start${c.seq}`);
      await new Promise((r) => setTimeout(r, 500));
      order.push(`end${c.seq}`);
    });
    await host.conn.joinOperator({ sessionId: SID, role: "host", label: "PC" });
    await admin.conn.joinOperator({ sessionId: SID, role: "admin", label: "A" });
    await tick(100);
    await admin.conn.issue("jackpot", "advance");
    await admin.conn.issue("jackpot", "advance");
    await admin.conn.issue("jackpot", "advance");
    await tick(5000);
    expect(order).toEqual(["start1", "end1", "start2", "end2", "start3", "end3"]);
  });
});

describe("WebSocketTransport: 切断と復帰", () => {
  it("接続が切れたら自動で再接続し、不在中のコマンドを受け取る(二重適用なし)", async () => {
    const { host, admin, applied, bridge } = await trio();
    await admin.conn.issue("jackpot", "advance");
    await tick(100);
    expect(applied).toHaveLength(1);

    bridge.live.forEach((s) => s.drop());
    await admin.conn.issue("jackpot", "advance").catch(() => undefined); // 管理側も切断中(RPC にフォールバック)
    await tick(10_000);
    expect(host.conn.state.phase).toBe("connected");
    expect(applied.map((c) => c.seq)).toEqual([1, 2]);
    expect(bridge.live.length).toBeGreaterThanOrEqual(3);
  });

  it("再接続に失敗し続けると reconnecting になり、バックオフで間隔が延びる。復旧すれば戻る", async () => {
    const { host, bridge } = await trio();
    bridge.refuseConnections = true;
    bridge.live.forEach((s) => s.drop());
    const before = bridge.sockets.length;
    await tick(60_000);
    expect(host.conn.state.phase).toBe("reconnecting");
    const attempts = bridge.sockets.length - before;
    expect(attempts).toBeLessThan(5 * 3 + 1); // 3端末 × 60秒のバックオフ(2,4,8,16,30秒…)で各5回程度まで
    bridge.refuseConnections = false;
    await tick(40_000);
    expect(host.conn.state.phase).toBe("connected");
    expect(host.conn.state.failureCount).toBe(0);
  });

  it("応答が途絶えた(pong が返らない)接続は検知して再接続する", async () => {
    const { host, bridge } = await trio();
    const before = bridge.sockets.length;
    bridge.blackhole = true; // 通信が一切届かない(close も通知されない)
    await tick(25_000 + 10_000 + 100); // ping → pong 待ち → タイムアウト
    bridge.blackhole = false;
    await tick(20_000);
    expect(bridge.sockets.length).toBeGreaterThan(before);
    expect(host.conn.state.phase).toBe("connected");
  });

  it("端末認証が無効なら unauthorized で停止し、再接続し続けない", async () => {
    const { room, client, bridge } = await trio();
    const dev = (await room.call("poll", { sessionId: SID, deviceId: client.conn.state.deviceId, token: "x", sinceSeq: 0, stateVersion: 0 }).catch(() => null)) as null;
    void dev;
    // 保存済みトークンを壊して再接続させる
    const stored = client.store.get("octopus.session.client")!;
    client.store.set("octopus.session.client", JSON.stringify({ ...JSON.parse(stored), token: "broken" }));
    client.transport.stop();
    expect(client.conn.resume("client")).toBe(true);
    await tick(5000);
    expect(client.conn.state.phase).toBe("unauthorized");
    const count = bridge.sockets.length;
    await tick(120_000);
    expect(bridge.sockets.length).toBe(count);
  });

  it("セッション終了で ended になり、再接続しない", async () => {
    const { room, host, bridge } = await trio();
    await room.call("close", {});
    await tick(5000);
    expect(host.conn.state.phase).toBe("ended");
    const count = bridge.sockets.length;
    await tick(120_000);
    expect(bridge.sockets.length).toBe(count);
  });

  it("別タブで同じ端末が接続すると、古い接続は置き換えられ、再接続の取り合いにならない", async () => {
    const { room, bridge, client } = await trio();
    const second = makeWsDevice(room, bridge, { store: client.store });
    expect(second.conn.resume("client")).toBe(true);
    await tick(5000);
    const count = bridge.sockets.length;
    await tick(120_000);
    // 追加の再接続が発生しない(古い方が奪い返さない)
    expect(bridge.sockets.length).toBe(count);
    expect(second.conn.state.phase).toBe("connected");
  });
});

describe("WebSocketTransport: 可視状態と節約", () => {
  it("長く非表示なら切断し、表示に戻ると再接続して差分を受け取る", async () => {
    const { client, admin, host, bridge } = await trio();
    client.conn.setVisible(false);
    await tick(61_000);
    expect(bridge.live).toHaveLength(2); // 参加者の接続だけ手放した
    await host.conn.publish({ screen: "after" });
    await admin.conn.issue("jackpot", "advance");
    await tick(100);
    client.conn.setVisible(true);
    await tick(100);
    expect(bridge.live).toHaveLength(3);
    expect(client.conn.state.roomState?.data).toEqual({ screen: "after" });
    expect(client.conn.state.headSeq).toBe(1);
  });

  it("短時間の非表示では切断しない", async () => {
    const { client, bridge } = await trio();
    client.conn.setVisible(false);
    await tick(30_000);
    client.conn.setVisible(true);
    await tick(100);
    expect(bridge.live).toHaveLength(3);
  });

  it("非表示の間は切断後に再接続しようとしない", async () => {
    const { client, bridge } = await trio();
    client.conn.setVisible(false);
    await tick(61_000);
    const count = bridge.sockets.length;
    await tick(120_000);
    expect(bridge.sockets.length).toBe(count);
  });

  it("生存確認(ping)は 25 秒ごとで、サーバの auto-response なので課金される DO リクエストを増やさない", async () => {
    const { room, bridge } = await trio();
    const incomingBefore = room.counts.wsIncoming;
    await tick(5 * 60 * 1000);
    expect(room.counts.wsIncoming).toBe(incomingBefore);
    const pings = bridge.sockets[0].sent.filter((m) => m === "ping").length;
    expect(pings).toBeGreaterThanOrEqual(10);
  });
});

describe("WebSocketTransport: フォールバック", () => {
  it("WebSocket が一度も繋がらない環境では、ポーリングに切り替わって動作する", async () => {
    const { room, bridge } = await setup();
    bridge.refuseConnections = true;
    const admin = makeWsDevice(room, bridge, { memberId: "b" });
    const client = makeWsDevice(room, bridge);
    await admin.conn.joinOperator({ sessionId: SID, role: "admin", label: "A" });
    await client.conn.joinClient({ code: "WSCODE" });
    await tick(60_000);
    expect(client.transport.isUsingFallback).toBe(true);
    expect(client.conn.state.phase).toBe("connected");
    expect(client.api.calls.poll ?? 0).toBeGreaterThan(0);
    // フォールバック中も、コマンド発行は RPC で動く
    await admin.conn.issue("jackpot", "advance");
    expect(admin.api.calls.issueCommand).toBe(1);
  });

  it("WebSocket のコンストラクタが使えない(例外)環境でもポーリングで動く", async () => {
    const { room } = await setup();
    const api = createRoomApi(room, null);
    const fallback = new PollingTransport(api, noJitter, DEFAULT_POLLING_OPTIONS);
    const transport = new WebSocketTransport(
      {
        ...DEFAULT_WS_OPTIONS,
        url: () => "wss://x",
        createSocket: () => {
          throw new Error("WebSocket is not defined");
        },
        fallback,
      },
      noJitter
    );
    const conn = new SessionConnection({ api, store: new MemoryDeviceStore(), transport, now: dateClock.now });
    await conn.joinClient({ code: "WSCODE" });
    await tick(60_000);
    expect(transport.isUsingFallback).toBe(true);
    expect(api.calls.poll ?? 0).toBeGreaterThan(0);
  });

  it("再接続が短時間に繰り返されると(不安定)ポーリングへ切り替えて暴走を防ぐ", async () => {
    const { room, bridge } = await setup();
    const client = makeWsDevice(room, bridge, { ws: { reconnectMaxPerWindow: 5, backoffBaseMs: 10, backoffMaxMs: 20 } });
    await client.conn.joinClient({ code: "WSCODE" });
    await tick(100);
    for (let i = 0; i < 10 && !client.transport.isUsingFallback; i++) {
      bridge.live.forEach((s) => s.drop());
      await tick(200);
    }
    expect(client.transport.isUsingFallback).toBe(true);
    expect(client.conn.state.phase).toBe("connected");
  });

  it("接続できていた環境での一時的な断では、すぐにはポーリングへ切り替えない", async () => {
    const { client, bridge } = await trio();
    bridge.refuseConnections = true;
    bridge.live.forEach((s) => s.drop());
    await tick(30_000);
    expect(client.transport.isUsingFallback).toBe(false);
  });
});

describe("WebSocketTransport: コマンド発行の経路", () => {
  it("WebSocket が使えない間のコマンド発行は RPC に切り替わり、同じ requestId で1件だけ実行される", async () => {
    const { admin, applied, bridge } = await trio();
    bridge.refuseConnections = true;
    bridge.live.forEach((s) => s.drop());
    await tick(50);
    await admin.conn.issue("jackpot", "advance");
    expect(admin.api.calls.issueCommand).toBe(1);
    bridge.refuseConnections = false;
    await tick(60_000);
    expect(applied).toHaveLength(1);
  });

  it("応答が来ない WebSocket 発行はタイムアウトして RPC で再送され、二重実行されない", async () => {
    const { admin, applied, room, bridge } = await trio();
    // サーバは実行できるが応答が返らない状況(送信は届くが返信が消える)
    const rpcBefore = room.counts.rpc;
    const adminSocket = bridge.live[1];
    const originalSend = adminSocket.server.onServerSend;
    adminSocket.server.onServerSend = (data) => {
      if (data.includes('"issued"')) return;
      originalSend?.(data);
    };
    const p = admin.conn.issue("jackpot", "advance");
    await tick(9000);
    const result = await p;
    expect(result.duplicate).toBe(true); // WS でサーバは実行済み → RPC 再送は重複として同じ seq
    expect(room.counts.rpc).toBe(rpcBefore + 1);
    await tick(1000);
    expect(applied).toHaveLength(1);
  });
});
