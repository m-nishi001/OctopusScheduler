import { describe, expect, it } from "vitest";
import { FakeClock, FakeRoom } from "../../../testing";
import type { FakeSocket } from "../../../testing";
import type { JoinResult } from "../../../shared/protocol";
import type { SessionMeta } from "../../../shared/session-types";
import {
  WS_CLOSE_REPLACED,
  WS_CLOSE_SESSION_ENDED,
  WS_CLOSE_UNAUTHORIZED,
} from "../../../shared/ws-protocol";
import { COMMAND_RING_SIZE } from "../../../shared/session-types";
import { PRESENCE_BROADCAST_DELAY_MS } from "../room-core";

const SID = "session-1";

function meta(): SessionMeta {
  return {
    id: SID,
    code: "ABC234",
    name: "夏祭り",
    ownerMemberId: "admin1",
    status: "lobby",
    mode: "live",
    createdAtMs: 1_700_000_000_000,
    expiresAtMs: 1_700_000_000_000 + 12 * 3600 * 1000,
    hostDeviceId: null,
  };
}

async function scene() {
  const room = new FakeRoom(new FakeClock(1_700_000_000_000));
  await room.init(meta());
  const host = await room.call<JoinResult>("joinOperator", { sessionId: SID, role: "host", label: "PC" }, "admin1");
  const admin = await room.call<JoinResult>("joinOperator", { sessionId: SID, role: "admin", label: "スマホ" }, "admin2");
  const client = await room.call<JoinResult>("joinClient", { code: "ABC234", label: "太郎" });
  const creds = (j: JoinResult) => ({ sessionId: SID, deviceId: j.deviceId, token: j.token });
  const wsHost = await room.connectAndAuth(creds(host));
  const wsAdmin = await room.connectAndAuth(creds(admin));
  const wsClient = await room.connectAndAuth(creds(client));
  return { room, host, admin, client, creds, wsHost, wsAdmin, wsClient };
}

const issue = (room: FakeRoom, creds: { sessionId: string; deviceId: string; token: string }, requestId: string, type = "advance", game = "jackpot") =>
  room.call("issueCommand", { ...creds, requestId, game, type });

describe("SessionRoomCore: WebSocket 認証", () => {
  it("正しい端末は接続直後に現在の状態を1回受け取る", async () => {
    const { wsHost, wsClient } = await scene();
    expect(wsHost.updates()).toHaveLength(1);
    expect(wsHost.lastUpdate()?.session).toMatchObject({ id: SID, name: "夏祭り", status: "live" });
    expect(wsClient.updates()).toHaveLength(1);
  });

  it("トークンが違う端末は error を受け取り 4401 で切られる", async () => {
    const { room, host } = await scene();
    const ws = await room.connectAndAuth({ sessionId: SID, deviceId: host.deviceId, token: "wrong" });
    expect(ws.lastError()).toMatchObject({ t: "error", code: "DEVICE_UNAUTHORIZED" });
    expect(ws.closed?.code).toBe(WS_CLOSE_UNAUTHORIZED);
  });

  it("存在しない端末・別セッションIDは拒否される", async () => {
    const { room, host } = await scene();
    const unknown = await room.connectAndAuth({ sessionId: SID, deviceId: "nobody-device", token: host.token });
    expect(unknown.closed?.code).toBe(WS_CLOSE_UNAUTHORIZED);
    const wrongSession = await room.connectAndAuth({ sessionId: "other-session", deviceId: host.deviceId, token: host.token });
    expect(wrongSession.closed?.code).toBe(WS_CLOSE_UNAUTHORIZED);
  });

  it("未初期化のセッションは SESSION_NOT_FOUND で 4410 を返し、再接続させない", async () => {
    const room = new FakeRoom();
    const ws = await room.connectAndAuth({ sessionId: SID, deviceId: "d", token: "t" });
    expect(ws.lastError()?.code).toBe("SESSION_NOT_FOUND");
    expect(ws.closed?.code).toBe(WS_CLOSE_SESSION_ENDED);
  });

  it("JSON でないメッセージ・バイナリ・未知の型は無視する(接続は維持)", async () => {
    const { room, wsClient } = await scene();
    const before = wsClient.received.length;
    await room.send(wsClient, "not json");
    await room.send(wsClient, JSON.stringify({ t: "unknown" }));
    await room.send(wsClient, JSON.stringify(null));
    expect(wsClient.closed).toBeNull();
    expect(wsClient.received.length).toBe(before);
  });

  it("同じ端末が再接続したら古い接続は 4409 で置き換えられる", async () => {
    const { room, client, creds, wsClient } = await scene();
    const again = await room.connectAndAuth(creds(client));
    expect(wsClient.closed?.code).toBe(WS_CLOSE_REPLACED);
    expect(again.closed).toBeNull();
    // 置き換えられた古い接続には以後 push されない
    const before = wsClient.received.length;
    await room.core.broadcast();
    expect(wsClient.received.length).toBe(before);
  });
});

describe("SessionRoomCore: push 配信", () => {
  it("コマンドは運営端末にだけ中身つきで push され、参加者には head のみ", async () => {
    const { room, admin, creds, wsHost, wsAdmin, wsClient } = await scene();
    await issue(room, creds(admin), "r1");
    expect(wsHost.lastUpdate()?.commands.map((c) => c.seq)).toEqual([1]);
    expect(wsAdmin.lastUpdate()?.commands.map((c) => c.seq)).toEqual([1]);
    expect(wsClient.lastUpdate()?.commands).toEqual([]);
    expect(wsClient.lastUpdate()?.head.seq).toBe(1);
  });

  it("push 済みのコマンドは次の push で重複しない", async () => {
    const { room, admin, creds, wsHost } = await scene();
    await issue(room, creds(admin), "r1");
    await issue(room, creds(admin), "r2");
    expect(wsHost.updates().flatMap((u) => u.commands.map((c) => c.seq))).toEqual([1, 2]);
  });

  it("再送(重複)コマンドは新しい push を起こさない", async () => {
    const { room, admin, creds, wsHost } = await scene();
    await issue(room, creds(admin), "r1");
    const n = wsHost.received.length;
    const dup = await issue(room, creds(admin), "r1");
    expect((dup as { duplicate: boolean }).duplicate).toBe(true);
    expect(wsHost.received.length).toBe(n);
  });

  it("状態の公開は全端末に push され、同じ版は二度送らない", async () => {
    const { room, host, creds, wsClient, wsAdmin } = await scene();
    await room.call("publishState", { ...creds(host), data: { screen: "draw" }, clientInput: ["jackpot.stopRoulette"] });
    expect(wsClient.lastUpdate()?.state?.data).toEqual({ screen: "draw" });
    expect(wsClient.lastUpdate()?.state?.clientInput).toEqual(["jackpot.stopRoulette"]);
    expect(wsAdmin.lastUpdate()?.state?.version).toBe(1);
    await room.core.broadcast(); // 在席だけが変わった push
    expect(wsClient.lastUpdate()?.state).toBeNull();
  });

  it("参加者はホストが許可した入力だけ送れて、運営端末に届く", async () => {
    const { room, host, client, creds, wsHost } = await scene();
    await expect(issue(room, creds(client), "c1", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);
    await room.call("publishState", { ...creds(host), data: {}, clientInput: ["jackpot.stopRoulette"] });
    await issue(room, creds(client), "c2", "stopRoulette");
    expect(wsHost.lastUpdate()?.commands.map((c) => [c.type, c.issuerRole])).toEqual([["stopRoulette", "client"]]);
  });

  it("再接続時は手元の seq / 版からの差分だけを受け取る", async () => {
    const { room, host, admin, creds, wsHost } = await scene();
    await issue(room, creds(admin), "r1");
    await issue(room, creds(admin), "r2");
    await room.disconnect(wsHost);
    await issue(room, creds(admin), "r3");
    const again = await room.connectAndAuth(creds(host), 1, 0);
    expect(again.lastUpdate()?.commands.map((c) => c.seq)).toEqual([2, 3]);
    expect(again.lastUpdate()?.resync).toBe(false);
  });

  it("リングを超えて遅れた再接続は resync になり状態を取り直す", async () => {
    const { room, host, admin, creds } = await scene();
    await room.call("publishState", { ...creds(host), data: { a: 1 } });
    for (let i = 0; i < COMMAND_RING_SIZE + 5; i++) await issue(room, creds(admin), `r${i}`);
    const again = await room.connectAndAuth(creds(host), 0, 1);
    expect(again.lastUpdate()?.resync).toBe(true);
    expect(again.lastUpdate()?.commands).toEqual([]);
    expect(again.lastUpdate()?.state?.data).toEqual({ a: 1 });
  });

  it("切断済みソケットへの送信失敗が他の端末への配信を止めない", async () => {
    const { room, admin, creds, wsClient, wsHost } = await scene();
    wsClient.closed = { code: 1006, reason: "gone" }; // close イベント前に送信すると例外になる状態
    await expect(issue(room, creds(admin), "r1")).resolves.toBeDefined();
    expect(wsHost.lastUpdate()?.commands).toHaveLength(1);
  });
});

describe("SessionRoomCore: 在席と ack", () => {
  it("ホストの ack は alarm でまとめて配信され、管理端末に未適用件数が分かる", async () => {
    const { room, admin, creds, wsAdmin } = await scene();
    await issue(room, creds(admin), "r1");
    await issue(room, creds(admin), "r2");
    expect(wsAdmin.lastUpdate()?.presence.host?.ackSeq).toBe(0);
    const wsHost = room.sockets[0];
    await room.send(wsHost, { t: "ack", seq: 2 });
    await room.runAlarm();
    expect(wsAdmin.lastUpdate()?.presence.host?.ackSeq).toBe(2);
  });

  it("ack は head を超える値・後退する値・ホスト以外からは無視される", async () => {
    const { room, admin, creds, wsAdmin, wsClient, wsHost } = await scene();
    await issue(room, creds(admin), "r1");
    await room.send(wsHost, { t: "ack", seq: 999 });
    await room.runAlarm();
    expect(wsAdmin.lastUpdate()?.presence.host?.ackSeq).toBe(1);
    await room.send(wsHost, { t: "ack", seq: 0 });
    await room.send(wsClient, { t: "ack", seq: 1 });
    await room.send(wsAdmin, { t: "ack", seq: 1 });
    await room.send(wsHost, { t: "ack", seq: Number.NaN as never });
    await room.runAlarm();
    expect(wsAdmin.lastUpdate()?.presence.host?.ackSeq).toBe(1);
  });

  it("入室が殺到しても alarm は1回だけ予約され、1回の push にまとまる", async () => {
    const { room, wsHost } = await scene();
    await room.runAlarm();
    const before = wsHost.received.length;
    for (let i = 0; i < 50; i++) await room.call("joinClient", { code: "ABC234", label: `c${i}` });
    expect(room.alarmAt).not.toBeNull();
    expect(wsHost.received.length).toBe(before);
    await room.runAlarm();
    expect(wsHost.received.length).toBe(before + 1);
    expect(wsHost.lastUpdate()?.presence.clientCount).toBe(51);
    expect(await room.runAlarm()).toBe(false);
  });

  it("alarm の予約は PRESENCE_BROADCAST_DELAY_MS 後", async () => {
    const { room } = await scene();
    await room.runAlarm();
    const now = room.clock.now();
    await room.call("joinClient", { code: "ABC234" });
    expect(room.alarmAt).toBe(now + PRESENCE_BROADCAST_DELAY_MS);
  });

  it("切断した端末は参加者数から外れ、その変化が配信される", async () => {
    const { room, wsClient, wsHost } = await scene();
    await room.runAlarm();
    await room.disconnect(wsClient);
    await room.runAlarm();
    expect(wsHost.lastUpdate()?.presence.clientCount).toBe(0);
  });

  it("ポーリング(WebSocket 非対応)の端末も在席に数えられる", async () => {
    const { room, creds, wsHost } = await scene();
    const poller = await room.call<JoinResult>("joinClient", { code: "ABC234", label: "古い端末" });
    await room.call("poll", { ...creds(poller), sinceSeq: 0, stateVersion: 0 });
    await room.core.broadcast();
    expect(wsHost.lastUpdate()?.presence.clientCount).toBe(2);
  });

  it("poll の RPC は WebSocket 版と同じ内容を返す(フォールバック)", async () => {
    const { room, admin, host, creds } = await scene();
    await issue(room, creds(admin), "r1");
    const polled = await room.call<{ commands: { seq: number }[]; head: { seq: number } }>("poll", { ...creds(host), sinceSeq: 0, stateVersion: 0 });
    expect(polled.commands.map((c) => c.seq)).toEqual([1]);
  });
});

describe("SessionRoomCore: 終了・復帰・エラー", () => {
  it("セッション終了で全端末へ closed を push してから切断し、以後の認証を拒否する", async () => {
    const { room, host, creds, wsHost, wsClient } = await scene();
    await room.call("close", {});
    expect(wsClient.lastUpdate()?.session.status).toBe("closed");
    expect(wsClient.closed?.code).toBe(WS_CLOSE_SESSION_ENDED);
    expect(wsHost.closed?.code).toBe(WS_CLOSE_SESSION_ENDED);
    const late = await room.connectAndAuth(creds(host));
    expect(late.lastError()?.code).toBe("SESSION_CLOSED");
    expect(late.closed?.code).toBe(WS_CLOSE_SESSION_ENDED);
    await expect(issue(room, { sessionId: SID, deviceId: host.deviceId, token: host.token }, "x")).rejects.toThrow(/SESSION_CLOSED/);
  });

  it("DO のハイバネートから復帰しても(メモリが消えても)配信を続けられる", async () => {
    const { room, admin, creds, wsHost } = await scene();
    await issue(room, creds(admin), "r1");
    room.hibernate();
    await issue(room, creds(admin), "r2");
    expect(wsHost.lastUpdate()?.commands.map((c) => c.seq)).toEqual([2]);
    // ハイバネート前の状態(seq)もストレージから引き継がれる
    expect(wsHost.lastUpdate()?.head.seq).toBe(2);
  });

  it("業務エラーは ok:false(メッセージにコード付き)で返り、想定外の例外はそのまま投げる", async () => {
    const { room } = await scene();
    const res = await room.rpc("joinClient", { code: "ABC234", deviceId: "x", token: "bad" });
    expect(res.ok).toBe(true); // 復帰に失敗しても新規の参加者として入室する
    const bad = await room.rpc("joinOperator", { sessionId: SID, role: "client" }, "admin1");
    expect(bad).toMatchObject({ ok: false });
    if (!bad.ok) expect(bad.message).toContain("[INVALID_ARGUMENT]");
    await expect(room.rpc("nope" as never, {})).resolves.toMatchObject({ ok: false });
  });

  it("init は二重に呼ばれても既存のセッションを上書きしない", async () => {
    const { room, host } = await scene();
    await room.init({ ...meta(), name: "上書き" });
    const polled = await room.call<{ session: { name: string; hostDeviceId: string } }>("poll", {
      sessionId: SID,
      deviceId: host.deviceId,
      token: host.token,
      sinceSeq: 0,
      stateVersion: 0,
    });
    expect(polled.session.name).toBe("夏祭り");
    expect(polled.session.hostDeviceId).toBe(host.deviceId);
  });

  it("同時に発行されたコマンドも DO の直列実行で欠番・重複なく採番される", async () => {
    const { room, admin, creds } = await scene();
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => issue(room, creds(admin), `p${i}`)));
    expect((results as { seq: number }[]).map((r) => r.seq).sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });
});
