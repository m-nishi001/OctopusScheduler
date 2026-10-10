import { describe, expect, it } from "vitest";
import { FakeClock, FakeRoom } from "../../../testing";
import type { FakeSocket } from "../../../testing";
import type { JoinResult, RoundOption } from "../../../shared/protocol";
import type { SessionMeta } from "../../../shared/session-types";

const SID = "session-round";
const OPTIONS: RoundOption[] = [
  { no: 1, text: "A" },
  { no: 2, text: "B" },
  { no: 3, text: "C" },
];

function meta(): SessionMeta {
  return {
    id: SID,
    code: "ROUND2",
    name: "回答会場",
    ownerMemberId: "a",
    status: "lobby",
    mode: "live",
    createdAtMs: 1_700_000_000_000,
    expiresAtMs: 1_700_000_000_000 + 12 * 3600 * 1000,
    hostDeviceId: null,
  };
}

type Creds = { sessionId: string; deviceId: string; token: string };
const creds = (j: JoinResult): Creds => ({ sessionId: SID, deviceId: j.deviceId, token: j.token });

async function scene(clients = 3) {
  const room = new FakeRoom(new FakeClock(1_700_000_000_000));
  await room.init(meta());
  const host = await room.call<JoinResult>("joinOperator", { sessionId: SID, role: "host", label: "PC" }, "a");
  const admin = await room.call<JoinResult>("joinOperator", { sessionId: SID, role: "admin", label: "A" }, "b");
  const wsHost = await room.connectAndAuth(creds(host));
  const wsAdmin = await room.connectAndAuth(creds(admin));
  const players: Array<{ join: JoinResult; ws: FakeSocket }> = [];
  for (let i = 0; i < clients; i++) {
    const join = await room.call<JoinResult>("joinClient", { code: "ROUND2", memberId: `m${i}`, label: `参加者${i}` });
    players.push({ join, ws: await room.connectAndAuth(creds(join)) });
  }
  const open = (key = "q1", durationMs = 20_000) => room.call("openRound", { ...creds(host), key, options: OPTIONS, durationMs });
  const answer = (p: { ws: FakeSocket }, key: string, no: number, requestId = `r-${Math.random()}`) =>
    room.send(p.ws, { t: "answer", requestId, key, no });
  return { room, host, admin, wsHost, wsAdmin, players, open, answer };
}

const lastOf = (ws: FakeSocket, t: string) => [...ws.received].reverse().find((m) => m.t === t) as Record<string, unknown> | undefined;

describe("DO: 回答ラウンド", () => {
  it("開始するとホスト/管理に round 要約が push され、参加者には届かない", async () => {
    const { wsHost, wsAdmin, players, open } = await scene();
    await open("q1", 20_000);
    expect(wsHost.lastUpdate()?.round).toMatchObject({ key: "q1", open: true, answerCount: 0 });
    expect(wsAdmin.lastUpdate()?.round).toMatchObject({ key: "q1" });
    expect(players[0].ws.lastUpdate()?.round).toBeNull();
  });

  it("WebSocket で回答でき、answered が返る。重複は最初の回答のまま duplicate", async () => {
    const { players, open, answer } = await scene();
    await open("q1");
    await answer(players[0], "q1", 2, "req-1");
    expect(lastOf(players[0].ws, "answered")).toMatchObject({ requestId: "req-1", no: 2, duplicate: false });
    await answer(players[0], "q1", 3, "req-2");
    expect(lastOf(players[0].ws, "answered")).toMatchObject({ requestId: "req-2", no: 2, duplicate: true });
  });

  it("不正な回答(締切後・存在しない選択肢・ラウンド無し)は rejected で、コードが付く", async () => {
    const { room, players, open, answer } = await scene();
    await answer(players[0], "q1", 1, "none");
    expect(lastOf(players[0].ws, "rejected")).toMatchObject({ requestId: "none", code: "ROUND_NOT_OPEN" });
    await open("q1", 5000);
    await answer(players[0], "q1", 9, "bad-no");
    expect(lastOf(players[0].ws, "rejected")).toMatchObject({ requestId: "bad-no", code: "INVALID_ARGUMENT" });
    room.clock.advance(5000);
    await answer(players[1], "q1", 1, "late");
    expect(lastOf(players[1].ws, "rejected")).toMatchObject({ requestId: "late", code: "ROUND_CLOSED" });
  });

  it("認証前のソケットからの回答は拒否される", async () => {
    const { room, open } = await scene();
    await open("q1");
    const anon = room.connect();
    await room.send(anon, { t: "answer", requestId: "x", key: "q1", no: 1 });
    expect(lastOf(anon, "rejected")).toMatchObject({ code: "DEVICE_UNAUTHORIZED" });
  });

  it("ホスト・管理は回答できない(FORBIDDEN)", async () => {
    const { room, wsHost, wsAdmin, open } = await scene();
    await open("q1");
    await room.send(wsHost, { t: "answer", requestId: "h", key: "q1", no: 1 });
    await room.send(wsAdmin, { t: "answer", requestId: "a", key: "q1", no: 1 });
    expect(lastOf(wsHost, "rejected")).toMatchObject({ code: "FORBIDDEN" });
    expect(lastOf(wsAdmin, "rejected")).toMatchObject({ code: "FORBIDDEN" });
  });

  it("回答は1件ごとに全端末へ push されず、回答数は alarm でまとめて運営端末へ届く", async () => {
    const { room, wsHost, players, open, answer } = await scene(5);
    await open("q1");
    await room.runAlarm();
    const before = wsHost.received.length;
    for (const p of players) await answer(p, "q1", 1);
    expect(wsHost.received.length).toBe(before); // まだ push されない
    await room.runAlarm();
    expect(wsHost.received.length).toBe(before + 1);
    expect(wsHost.lastUpdate()?.round).toMatchObject({ answerCount: 5 });
    // 参加者へは回答数を含む更新は届かない
    expect(players[0].ws.lastUpdate()?.round).toBeNull();
  });

  it("回答の書き込みはまとめて行われる: 300人が回答してもストレージ書き込みは数行", async () => {
    const { room, host, players, open, answer } = await scene(1);
    void players;
    const many: Array<{ ws: FakeSocket }> = [];
    for (let i = 0; i < 300; i++) {
      const j = await room.call<JoinResult>("joinClient", { code: "ROUND2", label: `c${i}` });
      many.push({ ws: await room.connectAndAuth(creds(j)) });
    }
    await open("q1");
    await room.runAlarm();
    const putsBefore = room.counts.storagePut;
    for (const p of many) await answer(p, "q1", 2);
    expect(room.counts.storagePut).toBe(putsBefore); // 回答処理中の書き込みは0
    await room.runAlarm(); // まとめて永続化(answers と round の2行)
    expect(room.counts.storagePut - putsBefore).toBeLessThanOrEqual(2);
    const result = await room.call<{ round: { answerCount: number }; answers: unknown[] }>("getAnswers", { ...creds(host), key: "q1" });
    expect(result.round.answerCount).toBe(300);
    expect(result.answers).toHaveLength(300);
  });

  it("締切(closeRound)の時点で未保存の回答も永続化される", async () => {
    const { room, host, players, open, answer } = await scene(3);
    await open("q1");
    for (const p of players) await answer(p, "q1", 1);
    await room.call("closeRound", { ...creds(host), key: "q1" });
    // DO が入れ替わっても(メモリが消えても)回答が残っている
    room.hibernate();
    const result = await room.call<{ answers: unknown[] }>("getAnswers", { ...creds(host), key: "q1" });
    expect(result.answers).toHaveLength(3);
  });

  it("alarm の後も同様に、ハイバネートから復帰しても回答が残る", async () => {
    const { room, host, players, open, answer } = await scene(2);
    await open("q1");
    for (const p of players) await answer(p, "q1", 3);
    await room.runAlarm();
    room.hibernate();
    const result = await room.call<{ round: { answerCount: number } }>("getAnswers", { ...creds(host), key: "q1" });
    expect(result.round.answerCount).toBe(2);
  });

  it("RPC の submitAnswer も同じ結果になる(WebSocket が使えない端末のフォールバック)", async () => {
    const { room, players, open } = await scene(2);
    await open("q1");
    const r = await room.call("submitAnswer", { ...creds(players[0].join), key: "q1", no: 2 });
    expect(r).toMatchObject({ no: 2, duplicate: false });
    const again = await room.call("submitAnswer", { ...creds(players[0].join), key: "q1", no: 1 });
    expect(again).toMatchObject({ no: 2, duplicate: true });
  });

  it("締切(サーバ時刻)を過ぎたら、ホストが何もしなくても回答は拒否される", async () => {
    const { room, players, open, answer } = await scene(1);
    await open("q1", 10_000);
    room.clock.advance(60_000);
    await answer(players[0], "q1", 1, "late");
    expect(lastOf(players[0].ws, "rejected")).toMatchObject({ code: "ROUND_CLOSED" });
  });

  it("新しいラウンドを開始すると、前のラウンドの回答は消えて再び回答できる", async () => {
    const { room, host, players, open, answer } = await scene(1);
    await open("q1", 10_000);
    await answer(players[0], "q1", 1);
    room.clock.advance(11_000);
    await open("q2", 10_000);
    await answer(players[0], "q2", 2, "second");
    expect(lastOf(players[0].ws, "answered")).toMatchObject({ requestId: "second", no: 2, duplicate: false });
    await expect(room.call("getAnswers", { ...creds(host), key: "q1" })).rejects.toThrow(/ROUND_NOT_OPEN/);
  });
});
