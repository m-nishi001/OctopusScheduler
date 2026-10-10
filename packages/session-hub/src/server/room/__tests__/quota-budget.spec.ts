/**
 * Cloudflare 無料枠の予算テスト。
 *
 * 想定最大(参加者300人・2時間のイベントを1日2回、全員一斉の再接続を各3回、20回の参加者入力)を
 * FakeRoom 上で再現し、課金対象の使用量が無料枠の BUDGET_RATIO(30%)に収まることを確認する。
 * 試算は課金ルール(接続=1、受信20件=1、送信は無料、RPCはWorker+DOで2)に従う。
 * ゲーム中に枠が尽きないよう、予算を超える変更はここで失敗する。
 */
import { describe, expect, it } from "vitest";
import { FakeClock, FakeRoom } from "../../../testing";
import type { FakeSocket } from "../../../testing";
import type { JoinResult } from "../../../shared/protocol";
import type { SessionMeta } from "../../../shared/session-types";
import { BUDGET_RATIO, EXPECTED_LOAD, FREE_TIER, WS_MESSAGES_PER_REQUEST } from "../../../shared/quota-budget";

const SID = "session-quota";

function meta(): SessionMeta {
  return {
    id: SID,
    code: "QUOTA2",
    name: "予算",
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

/** 1回のイベントを実行して、その間に増えたカウントを返す。 */
async function runEvent(clients: number, scale = 1) {
  const room = new FakeRoom(new FakeClock());
  await room.init(meta());
  const host = await room.call<JoinResult>("joinOperator", { sessionId: SID, role: "host", label: "PC" }, "a");
  const admin = await room.call<JoinResult>("joinOperator", { sessionId: SID, role: "admin", label: "A" }, "b");
  const wsHost = await room.connectAndAuth(creds(host));
  await room.connectAndAuth(creds(admin));

  // 参加者の入室と接続
  const joined: JoinResult[] = [];
  const sockets: FakeSocket[] = [];
  for (let i = 0; i < clients; i++) {
    const j = await room.call<JoinResult>("joinClient", { code: "QUOTA2", label: `c${i}` });
    joined.push(j);
    sockets.push(await room.connectAndAuth(creds(j)));
  }
  await room.runAlarm();

  // 全員が一斉に再接続(スマホの一斉リロード・電波断からの復帰)
  for (let storm = 0; storm < Math.max(1, Math.round(EXPECTED_LOAD.reconnectStormsPerEvent * scale)); storm++) {
    for (let i = 0; i < clients; i++) {
      sockets[i] = await room.connectAndAuth(creds(joined[i]), 0, 0);
    }
    await room.runAlarm();
  }

  // 管理端末のコマンドとホストの状態公開
  const adminCommands = Math.round(EXPECTED_LOAD.adminCommandsPerEvent * scale);
  const hostPublishes = Math.round(EXPECTED_LOAD.hostPublishesPerEvent * scale);
  for (let i = 0; i < adminCommands; i++) {
    await room.call("issueCommand", { ...creds(admin), requestId: `a${i}`, game: "jackpot", type: "advance" });
    if (i % 2 === 0) await room.send(wsHost, { t: "ack", seq: i + 1 });
  }
  for (let i = 0; i < hostPublishes; i++) {
    await room.call("publishState", { ...creds(host), data: { n: i }, clientInput: i % 20 === 0 ? ["quiz.answer"] : [] });
  }

  // 参加者の入力ラウンド(全員が1回ずつ送る。例: クイズ20問)
  const rounds = Math.max(1, Math.round(EXPECTED_LOAD.inputRoundsPerEvent * scale));
  await room.call("publishState", { ...creds(host), data: { open: true }, clientInput: ["quiz.answer"] });
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < clients; i++) {
      // 接続済みの参加者は WebSocket で送る(20件=1リクエスト換算)
      await room.send(sockets[i], { t: "issue", requestId: `r${r}-c${i}`, game: "quiz", type: "answer", payload: { no: (i % 4) + 1 } });
    }
    await room.runAlarm();
  }
  return room;
}

describe("Cloudflare 無料枠の予算", () => {
  it("想定最大のイベント(300人)を1日2回行っても、リクエスト数は無料枠の30%以内", async () => {
    const room = await runEvent(EXPECTED_LOAD.clients);
    const perEvent = room.billableRequests(WS_MESSAGES_PER_REQUEST);
    const perDay = perEvent * EXPECTED_LOAD.eventsPerDay;
    const budget = FREE_TIER.workersRequestsPerDay * BUDGET_RATIO;
    // eslint-disable-next-line no-console
    console.log(`[quota] 1イベント ${perEvent} リクエスト / 1日 ${perDay} (予算 ${budget}, 無料枠 ${FREE_TIER.workersRequestsPerDay})`);
    expect(perDay).toBeLessThanOrEqual(budget);
  }, 120_000);

  it("DO のストレージ書き込み行数は無料枠(10万行/日)の30%以内", async () => {
    const room = await runEvent(EXPECTED_LOAD.clients);
    const perDay = room.counts.storagePut * EXPECTED_LOAD.eventsPerDay;
    // eslint-disable-next-line no-console
    console.log(`[quota] DO書き込み 1日 ${perDay} (予算 ${FREE_TIER.doRowsWrittenPerDay * BUDGET_RATIO})`);
    expect(perDay).toBeLessThanOrEqual(FREE_TIER.doRowsWrittenPerDay * BUDGET_RATIO);
  }, 120_000);

  it("DO のストレージ読み取り行数は無料枠(500万行/日)の30%以内", async () => {
    const room = await runEvent(EXPECTED_LOAD.clients);
    const perDay = room.counts.storageGet * EXPECTED_LOAD.eventsPerDay;
    // eslint-disable-next-line no-console
    console.log(`[quota] DO読み取り 1日 ${perDay} (予算 ${FREE_TIER.doRowsReadPerDay * BUDGET_RATIO})`);
    expect(perDay).toBeLessThanOrEqual(FREE_TIER.doRowsReadPerDay * BUDGET_RATIO);
  }, 120_000);

  it("ポーリング方式だった場合は予算を大きく超える(WebSocket化の必要性を示す対照)", () => {
    // 300人が3秒間隔で2時間ポーリング = 300 * (7200/3) リクエスト。1日2回。
    const pollingPerDay = 300 * (7200 / 3) * EXPECTED_LOAD.eventsPerDay;
    expect(pollingPerDay).toBeGreaterThan(FREE_TIER.workersRequestsPerDay);
  });

  it("使用量は参加者数にほぼ比例する(負荷が2倍なら使用量は約2倍以下)", async () => {
    const small = await runEvent(60, 0.5);
    const big = await runEvent(120, 0.5);
    const ratio = big.billableRequests() / small.billableRequests();
    expect(ratio).toBeLessThan(2.4);
  }, 120_000);

  it("WebSocketの送信は課金に含まれず、参加者の入力はRPCより大幅に安い", async () => {
    const room = await runEvent(30, 0.1);
    expect(room.counts.wsOutgoing).toBeGreaterThan(room.counts.rpc); // 送信は大量だが
    expect(room.billableRequests()).toBeLessThan((room.counts.rpc + room.counts.wsConnect) * 2 + room.counts.wsIncoming); // 課金には効かない
  }, 120_000);
});
