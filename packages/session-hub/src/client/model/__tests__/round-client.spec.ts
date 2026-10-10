import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as service from "../../../server/engine/session-service";
import { FakeRoom, WsBridge, createRoomApi, dateClock } from "../../../testing";
import type { FaultInjector } from "../../../testing";
import type { RoundOption } from "../../../shared/protocol";
import type { SessionMeta } from "../../../shared/session-types";
import { MemoryDeviceStore } from "../device-store";
import { DEFAULT_POLLING_OPTIONS, PollingTransport, realTimers } from "../polling-transport";
import { SessionConnection } from "../session-connection";
import { DEFAULT_WS_OPTIONS, WebSocketTransport } from "../websocket-transport";
import { makeDevice, makeHub, tick } from "./harness";

const OPTIONS: RoundOption[] = [
  { no: 1, text: "A" },
  { no: 2, text: "B" },
];
const noJitter = { ...realTimers, random: () => 0.5 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

describe("SessionConnection の回答ラウンド(ポーリング/KV)", () => {
  async function scene() {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const host = makeDevice(hub, { memberId: "a" });
    const admin = makeDevice(hub, { memberId: "b" });
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
    return { hub, meta, host, admin };
  }
  const player = async (hub: ReturnType<typeof makeHub>, code: string, faults?: FaultInjector, label = "太郎") => {
    const d = makeDevice(hub, { faults });
    await d.conn.joinClient({ code, label, memberId: label });
    return d;
  };

  it("ホストが開始し、参加者が回答し、ホスト/管理が一覧と回答数を確認できる", async () => {
    const { hub, meta, host, admin } = await scene();
    const p1 = await player(hub, meta.code, undefined, "太郎");
    const p2 = await player(hub, meta.code, undefined, "花子");
    const round = await host.conn.openRound("q1:live", OPTIONS, 20_000);
    expect(round.deadlineMs).toBe(round.serverNowMs + 20_000);
    expect(await p1.conn.answer("q1:live", 1)).toMatchObject({ no: 1, duplicate: false });
    expect(await p2.conn.answer("q1:live", 2)).toMatchObject({ no: 2, duplicate: false });
    await tick(5000);
    expect(host.conn.state.round).toMatchObject({ key: "q1:live", open: true, answerCount: 2 });
    expect(admin.conn.state.round?.answerCount).toBe(2);
    expect(p1.conn.state.round).toBeNull();
    const result = await host.conn.getAnswers("q1:live");
    expect(result.answers.map((a) => [a.label, a.no])).toEqual([["太郎", 1], ["花子", 2]]);
    const closed = await admin.conn.closeRound("q1:live");
    expect(closed.open).toBe(false);
  });

  it("回答の応答が失われて再送されても、1件だけ採用され duplicate が返る", async () => {
    const { hub, meta, host } = await scene();
    let dropOnce = true;
    const p = await player(hub, meta.code, {
      decide: (e) => {
        if (e === "submitAnswer" && dropOnce) {
          dropOnce = false;
          return "dropResponse";
        }
        return "ok";
      },
    });
    await host.conn.openRound("q1", OPTIONS, 20_000);
    const promise = p.conn.answer("q1", 2);
    await tick(2000);
    expect(await promise).toMatchObject({ no: 2, duplicate: true });
    expect((await host.conn.getAnswers("q1")).answers).toHaveLength(1);
  });

  it("業務エラー(締切後)は再送せずに例外にする", async () => {
    const { hub, meta, host } = await scene();
    const p = await player(hub, meta.code);
    await host.conn.openRound("q1", OPTIONS, 5000);
    dateClock.advance(6000);
    await expect(p.conn.answer("q1", 1)).rejects.toThrow(/ROUND_CLOSED/);
    expect(p.api.calls.submitAnswer).toBe(1);
  });

  it("通信失敗が続けば再送回数を使い切って例外になる", async () => {
    const { hub, meta, host } = await scene();
    const p = await player(hub, meta.code, { decide: (e) => (e === "submitAnswer" ? "dropRequest" : "ok") });
    await host.conn.openRound("q1", OPTIONS, 20_000);
    const promise = p.conn.answer("q1", 1);
    const assertion = expect(promise).rejects.toThrow();
    await tick(5000);
    await assertion;
    expect(p.api.calls.submitAnswer).toBe(3);
  });

  it("ホストの開始の再送(リロード)は続きとして扱われ、回答は消えない", async () => {
    const { hub, meta, host } = await scene();
    const p = await player(hub, meta.code);
    const first = await host.conn.openRound("q1", OPTIONS, 20_000);
    await p.conn.answer("q1", 2);
    dateClock.advance(2000);
    const again = await host.conn.openRound("q1", OPTIONS, 20_000);
    expect(again.deadlineMs).toBe(first.deadlineMs);
    expect((await host.conn.getAnswers("q1")).answers).toHaveLength(1);
  });

  it("入室前の操作は拒否される", async () => {
    const hub = makeHub();
    const d = makeDevice(hub);
    await expect(d.conn.answer("q", 1)).rejects.toThrow("not joined");
    await expect(d.conn.openRound("q", OPTIONS, 5000)).rejects.toThrow("not joined");
    await expect(d.conn.closeRound("q")).rejects.toThrow("not joined");
    await expect(d.conn.getAnswers("q")).rejects.toThrow("not joined");
  });
});

describe("SessionConnection の回答ラウンド(WebSocket/DO)", () => {
  const SID = "session-ws-round";
  function meta(): SessionMeta {
    return {
      id: SID,
      code: "WSRND2",
      name: "WS回答",
      ownerMemberId: "a",
      status: "lobby",
      mode: "live",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 12 * 3600 * 1000,
      hostDeviceId: null,
    };
  }
  function wsDevice(room: FakeRoom, bridge: WsBridge, memberId: string | null) {
    const api = createRoomApi(room, memberId);
    const transport = new WebSocketTransport(
      { ...DEFAULT_WS_OPTIONS, url: (id) => `wss://x/ws/${id}`, createSocket: bridge.createSocket, fallback: new PollingTransport(api, noJitter, DEFAULT_POLLING_OPTIONS) },
      noJitter
    );
    const conn = new SessionConnection({
      api,
      store: new MemoryDeviceStore(),
      transport,
      now: dateClock.now,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
    return { api, conn, transport };
  }
  async function scene() {
    const room = new FakeRoom(dateClock);
    await room.init(meta());
    const bridge = new WsBridge(room);
    const host = wsDevice(room, bridge, "a");
    await host.conn.joinOperator({ sessionId: SID, role: "host", label: "PC" });
    const player = wsDevice(room, bridge, null);
    await player.conn.joinClient({ code: "WSRND2", label: "太郎" });
    await tick(100);
    return { room, bridge, host, player };
  }

  it("参加者の回答は WebSocket で送られ、RPC の submitAnswer は使われない", async () => {
    const { host, player, room } = await scene();
    await host.conn.openRound("q1", OPTIONS, 20_000);
    const rpcBefore = room.counts.rpc;
    expect(await player.conn.answer("q1", 2)).toMatchObject({ no: 2, duplicate: false });
    expect(room.counts.rpc).toBe(rpcBefore);
    expect(player.api.calls.submitAnswer ?? 0).toBe(0);
    // 回答数は alarm でまとめて運営端末へ
    await room.runAlarm();
    await tick(100);
    expect(host.conn.state.round?.answerCount).toBe(1);
  });

  it("WebSocket が使えない間は RPC に切り替わり、同じ結果になる", async () => {
    const { host, player, bridge } = await scene();
    await host.conn.openRound("q1", OPTIONS, 20_000);
    bridge.refuseConnections = true;
    bridge.live.forEach((s) => s.drop());
    await tick(50);
    expect(await player.conn.answer("q1", 1)).toMatchObject({ no: 1 });
    expect(player.api.calls.submitAnswer).toBe(1);
  });

  it("WebSocket の応答が消えても、タイムアウト後に RPC で再送され重複しない", async () => {
    const { host, player, bridge } = await scene();
    await host.conn.openRound("q1", OPTIONS, 20_000);
    const socket = bridge.live[1];
    const original = socket.server.onServerSend;
    socket.server.onServerSend = (data) => {
      if (data.includes('"answered"')) return;
      original?.(data);
    };
    const promise = player.conn.answer("q1", 2);
    await tick(9000);
    expect(await promise).toMatchObject({ no: 2, duplicate: true });
    expect((await host.conn.getAnswers("q1")).answers).toHaveLength(1);
  });

  it("締切後の回答は、ホストが何もしなくても拒否される", async () => {
    const { host, player } = await scene();
    await host.conn.openRound("q1", OPTIONS, 5000);
    dateClock.advance(6000);
    await expect(player.conn.answer("q1", 1)).rejects.toThrow(/ROUND_CLOSED/);
  });
});
