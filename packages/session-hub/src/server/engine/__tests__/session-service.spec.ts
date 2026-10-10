import { describe, expect, it } from "vitest";
import { createTestHub } from "../../../testing";
import * as svc from "../session-service";
import { parseHubErrorCode } from "../hub-error";
import {
  COMMAND_RING_SIZE,
  HOST_STALE_MS,
  MAX_ACTIVE_SESSIONS,
  MAX_COMMAND_PAYLOAD_BYTES,
  MAX_STATE_BYTES,
  SESSION_TTL_MS,
} from "../../../shared/session-types";
import type { JoinResult } from "../../../shared/protocol";

async function code(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (e) {
    return parseHubErrorCode((e as Error).message) ?? (e as Error).message;
  }
}

async function setup() {
  const hub = createTestHub();
  const meta = await svc.createSession(hub.deps, { name: "夏祭り" }, "admin1");
  const host = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "host", label: "体育館PC" }, "admin1");
  const admin = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "admin", label: "スマホ" }, "admin2");
  const client = await svc.joinClient(hub.deps, { code: meta.code, memberId: "u1", label: "太郎" });
  const creds = (j: JoinResult) => ({ sessionId: meta.id, deviceId: j.deviceId, token: j.token });
  return { hub, meta, host, admin, client, creds };
}

describe("createSession / listSessions / closeSession", () => {
  it("セッションを作成し、一覧に載り、参加コードが付く", async () => {
    const hub = createTestHub();
    const meta = await svc.createSession(hub.deps, { name: "  新年会 " }, "a");
    expect(meta).toMatchObject({ name: "新年会", status: "lobby", mode: "live", ownerMemberId: "a", hostDeviceId: null });
    expect(meta.code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    const list = await svc.listSessions(hub.deps);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: meta.id, code: meta.code });
  });

  it("名前が空・modeが不正なら拒否する", async () => {
    const hub = createTestHub();
    expect(await code(svc.createSession(hub.deps, { name: "  " }, "a"))).toBe("INVALID_ARGUMENT");
    expect(await code(svc.createSession(hub.deps, { name: "x", mode: "bogus" as never }, "a"))).toBe("INVALID_ARGUMENT");
  });

  it("参加コードは進行中のセッション間で重複しない", async () => {
    const hub = createTestHub();
    const codes = new Set<string>();
    for (let i = 0; i < 10; i++) codes.add((await svc.createSession(hub.deps, { name: `s${i}` }, "a")).code);
    expect(codes.size).toBe(10);
  });

  it("進行中セッションの上限を超えると拒否し、終了すれば作れる", async () => {
    const hub = createTestHub();
    const ids: string[] = [];
    for (let i = 0; i < MAX_ACTIVE_SESSIONS; i++) ids.push((await svc.createSession(hub.deps, { name: `s${i}` }, "a")).id);
    expect(await code(svc.createSession(hub.deps, { name: "over" }, "a"))).toBe("TOO_MANY_SESSIONS");
    await svc.closeSession(hub.deps, { sessionId: ids[0] });
    await expect(svc.createSession(hub.deps, { name: "ok" }, "a")).resolves.toBeDefined();
  });

  it("同時作成してもロックで直列化され、一覧が欠けない", async () => {
    const hub = createTestHub();
    await Promise.all(Array.from({ length: 8 }, (_, i) => svc.createSession(hub.deps, { name: `s${i}` }, "a")));
    expect(await svc.listSessions(hub.deps)).toHaveLength(8);
  });

  it("終了したセッションには入室できず、一定時間後に一覧から消える", async () => {
    const { hub, meta, client, creds } = await setup();
    await svc.closeSession(hub.deps, { sessionId: meta.id });
    expect(await code(svc.joinClient(hub.deps, { code: meta.code }))).toBe("SESSION_NOT_FOUND");
    expect(
      await code(svc.poll(hub.deps, { ...creds(client), sinceSeq: 0, stateVersion: 0 }))
    ).toBe("SESSION_CLOSED");
    expect((await svc.listSessions(hub.deps)).map((s) => s.status)).toEqual(["closed"]);
    hub.clock.advance(61 * 60 * 1000);
    expect(await svc.listSessions(hub.deps)).toHaveLength(0);
  });

  it("存在しないセッションの終了は SESSION_NOT_FOUND", async () => {
    const hub = createTestHub();
    expect(await code(svc.closeSession(hub.deps, { sessionId: "nope" }))).toBe("SESSION_NOT_FOUND");
  });

  it("有効期限が切れたセッションは使えない", async () => {
    const { hub, client, creds } = await setup();
    hub.clock.advance(SESSION_TTL_MS + 1);
    expect(await code(svc.poll(hub.deps, { ...creds(client), sinceSeq: 0, stateVersion: 0 }))).toBe("SESSION_CLOSED");
  });
});

describe("入室", () => {
  it("ホストが入室するとセッションが live になり hostDeviceId が入る", async () => {
    const { host, hub, meta } = await setup();
    expect(host.session.status).toBe("live");
    expect(host.session.hostDeviceId).toBe(host.deviceId);
    const stored = await hub.deps.repoFor(meta.id).getMeta();
    expect(stored?.hostDeviceId).toBe(host.deviceId);
  });

  it("参加コードは大文字小文字・前後空白を問わない", async () => {
    const { hub, meta } = await setup();
    const j = await svc.joinClient(hub.deps, { code: ` ${meta.code.toLowerCase()} ` });
    expect(j.role).toBe("client");
  });

  it("不明な参加コードは SESSION_NOT_FOUND、空は INVALID_ARGUMENT", async () => {
    const { hub } = await setup();
    expect(await code(svc.joinClient(hub.deps, { code: "ZZZZZZ" }))).toBe("SESSION_NOT_FOUND");
    expect(await code(svc.joinClient(hub.deps, { code: "" }))).toBe("INVALID_ARGUMENT");
  });

  it("リロード復帰: 同じ deviceId で運営者が再入室すると同じ端末のまま", async () => {
    const { hub, meta, host } = await setup();
    const again = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "host", label: "体育館PC", deviceId: host.deviceId }, "admin1");
    expect(again.deviceId).toBe(host.deviceId);
    expect(again.token).toBe(host.token);
  });

  it("他人のdeviceIdでは復帰できず別端末になる", async () => {
    const { hub, meta, admin } = await setup();
    const other = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "admin", label: "x", deviceId: admin.deviceId }, "someone-else");
    expect(other.deviceId).not.toBe(admin.deviceId);
  });

  it("参加者のリロード復帰は deviceId と token の両方が一致したときだけ", async () => {
    const { hub, meta, client } = await setup();
    const ok = await svc.joinClient(hub.deps, { code: meta.code, deviceId: client.deviceId, token: client.token });
    expect(ok.deviceId).toBe(client.deviceId);
    const bad = await svc.joinClient(hub.deps, { code: meta.code, deviceId: client.deviceId, token: "wrong" });
    expect(bad.deviceId).not.toBe(client.deviceId);
  });

  it("運営者のroleにclientは指定できない", async () => {
    const { hub, meta } = await setup();
    expect(await code(svc.joinOperator(hub.deps, { sessionId: meta.id, role: "client" as never, label: "x" }, "a"))).toBe("INVALID_ARGUMENT");
  });

  it("ホストが在席中は別端末のホスト入室を拒否し、takeover で引き継げる", async () => {
    const { hub, meta, host, creds } = await setup();
    await svc.poll(hub.deps, { ...creds(host), sinceSeq: 0, stateVersion: 0 });
    expect(await code(svc.joinOperator(hub.deps, { sessionId: meta.id, role: "host", label: "別PC" }, "admin1"))).toBe("HOST_ALREADY_CONNECTED");
    const taken = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "host", label: "別PC", takeover: true }, "admin1");
    expect(taken.session.hostDeviceId).toBe(taken.deviceId);
    // 旧ホストは状態を公開できなくなる
    expect(await code(svc.publishState(hub.deps, { ...creds(host), data: {} }))).toBe("NOT_HOST");
  });

  it("ホストが一定時間不在なら takeover なしで引き継げる", async () => {
    const { hub, meta } = await setup();
    hub.clock.advance(HOST_STALE_MS + 1);
    const j = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "host", label: "新PC" }, "admin1");
    expect(j.session.hostDeviceId).toBe(j.deviceId);
  });
});

describe("認証", () => {
  it("token が違う・deviceId が不明・欠落は DEVICE_UNAUTHORIZED", async () => {
    const { hub, meta, admin } = await setup();
    const base = { sessionId: meta.id, sinceSeq: 0, stateVersion: 0 };
    expect(await code(svc.poll(hub.deps, { ...base, deviceId: admin.deviceId, token: "x" }))).toBe("DEVICE_UNAUTHORIZED");
    expect(await code(svc.poll(hub.deps, { ...base, deviceId: "nope", token: admin.token }))).toBe("DEVICE_UNAUTHORIZED");
    expect(await code(svc.poll(hub.deps, { ...base, deviceId: admin.deviceId, token: "" }))).toBe("DEVICE_UNAUTHORIZED");
  });

  it("別セッションの端末では認証できない", async () => {
    const { hub, admin } = await setup();
    const other = await svc.createSession(hub.deps, { name: "別" }, "a");
    expect(
      await code(svc.poll(hub.deps, { sessionId: other.id, deviceId: admin.deviceId, token: admin.token, sinceSeq: 0, stateVersion: 0 }))
    ).toBe("DEVICE_UNAUTHORIZED");
  });

  it("存在しないセッションは SESSION_NOT_FOUND", async () => {
    const { hub, admin } = await setup();
    expect(
      await code(svc.poll(hub.deps, { sessionId: "none", deviceId: admin.deviceId, token: admin.token, sinceSeq: 0, stateVersion: 0 }))
    ).toBe("SESSION_NOT_FOUND");
  });
});

describe("コマンド", () => {
  it("管理がコマンドを発行すると seq が単調増加し、ホストと管理が受け取る", async () => {
    const { hub, host, admin, creds } = await setup();
    const a = await svc.issueCommand(hub.deps, { ...creds(admin), requestId: "r1", game: "jackpot", type: "advance" });
    const b = await svc.issueCommand(hub.deps, { ...creds(admin), requestId: "r2", game: "jackpot", type: "setScreen", payload: { screen: "ending" } });
    expect([a.seq, b.seq]).toEqual([1, 2]);
    const polled = await svc.poll(hub.deps, { ...creds(host), sinceSeq: 0, stateVersion: 0 });
    expect(polled.commands.map((c) => [c.seq, c.type, c.issuerRole])).toEqual([
      [1, "advance", "admin"],
      [2, "setScreen", "admin"],
    ]);
    expect(polled.commands[1].payload).toEqual({ screen: "ending" });
    expect(polled.head.seq).toBe(2);
    const rest = await svc.poll(hub.deps, { ...creds(host), sinceSeq: 2, stateVersion: 0 });
    expect(rest.commands).toEqual([]);
  });

  it("同じ requestId の再送は新しい seq を作らない", async () => {
    const { hub, admin, creds } = await setup();
    const first = await svc.issueCommand(hub.deps, { ...creds(admin), requestId: "dup", game: "jackpot", type: "advance" });
    const second = await svc.issueCommand(hub.deps, { ...creds(admin), requestId: "dup", game: "jackpot", type: "advance" });
    expect(second).toEqual({ seq: first.seq, duplicate: true });
    expect((await hub.deps.repoFor(admin.session.id).getHead())?.seq).toBe(1);
  });

  it("同時発行(二重クリック・複数管理者)でも seq は欠番・重複なし", async () => {
    const { hub, meta, admin, creds } = await setup();
    const admin2 = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "admin", label: "2台目" }, "admin3");
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        svc.issueCommand(hub.deps, { ...creds(i % 2 ? admin : admin2), requestId: `r${i}`, game: "jackpot", type: "advance" })
      )
    );
    expect(results.map((r) => r.seq).sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("ホストはコマンドを発行できない(FORBIDDEN)", async () => {
    const { hub, host, creds } = await setup();
    expect(await code(svc.issueCommand(hub.deps, { ...creds(host), requestId: "r", game: "jackpot", type: "advance" }))).toBe("FORBIDDEN");
  });

  it("コマンド種別・requestId・ペイロードを検証する", async () => {
    const { hub, admin, creds } = await setup();
    const base = { ...creds(admin), requestId: "r" };
    expect(await code(svc.issueCommand(hub.deps, { ...base, game: "Jackpot", type: "advance" }))).toBe("INVALID_ARGUMENT");
    expect(await code(svc.issueCommand(hub.deps, { ...base, game: "jackpot", type: "bad type" }))).toBe("INVALID_ARGUMENT");
    expect(await code(svc.issueCommand(hub.deps, { ...base, requestId: "", game: "jackpot", type: "advance" }))).toBe("INVALID_ARGUMENT");
    expect(await code(svc.issueCommand(hub.deps, { ...base, requestId: "x".repeat(65), game: "jackpot", type: "advance" }))).toBe("INVALID_ARGUMENT");
    expect(
      await code(svc.issueCommand(hub.deps, { ...base, game: "jackpot", type: "advance", payload: "あ".repeat(MAX_COMMAND_PAYLOAD_BYTES) }))
    ).toBe("PAYLOAD_TOO_LARGE");
  });

  it("参加者はホストが許可した種別だけ送れ、許可が外れたら送れない", async () => {
    const { hub, host, client, creds } = await setup();
    const send = () => svc.issueCommand(hub.deps, { ...creds(client), requestId: `r${Math.random()}`, game: "jackpot", type: "stopRoulette" });
    expect(await code(send())).toBe("FORBIDDEN");
    await svc.publishState(hub.deps, { ...creds(host), data: {}, clientInput: ["jackpot.stopRoulette"] });
    await expect(send()).resolves.toMatchObject({ seq: 1 });
    await svc.publishState(hub.deps, { ...creds(host), data: {}, clientInput: [] });
    expect(await code(send())).toBe("FORBIDDEN");
  });

  it("参加者にはコマンドの中身を返さない(seq だけ)", async () => {
    const { hub, admin, client, creds } = await setup();
    await svc.issueCommand(hub.deps, { ...creds(admin), requestId: "r1", game: "jackpot", type: "advance" });
    const polled = await svc.poll(hub.deps, { ...creds(client), sinceSeq: 0, stateVersion: 0 });
    expect(polled.commands).toEqual([]);
    expect(polled.head.seq).toBe(1);
    expect(polled.resync).toBe(false);
  });

  it("遅れた端末がリングを超えて取りこぼすと resync になり状態を取り直す", async () => {
    const { hub, host, admin, creds } = await setup();
    await svc.publishState(hub.deps, { ...creds(host), data: { screen: "main" } });
    for (let i = 0; i < COMMAND_RING_SIZE + 5; i++) {
      await svc.issueCommand(hub.deps, { ...creds(admin), requestId: `r${i}`, game: "jackpot", type: "advance" });
    }
    const polled = await svc.poll(hub.deps, { ...creds(host), sinceSeq: 0, stateVersion: 1 });
    expect(polled.resync).toBe(true);
    expect(polled.commands).toEqual([]);
    expect(polled.state?.data).toEqual({ screen: "main" });
    // 追いつけば通常に戻る
    const caught = await svc.poll(hub.deps, { ...creds(host), sinceSeq: polled.head.seq - 2, stateVersion: 1 });
    expect(caught.resync).toBe(false);
    expect(caught.commands.map((c) => c.seq)).toEqual([polled.head.seq - 1, polled.head.seq]);
  });

  it("リングがちょうど満杯の境界でも取りこぼしなく受け取れる", async () => {
    const { hub, host, admin, creds } = await setup();
    for (let i = 0; i < COMMAND_RING_SIZE; i++) {
      await svc.issueCommand(hub.deps, { ...creds(admin), requestId: `r${i}`, game: "jackpot", type: "advance" });
    }
    const polled = await svc.poll(hub.deps, { ...creds(host), sinceSeq: 0, stateVersion: 0 });
    expect(polled.resync).toBe(false);
    expect(polled.commands).toHaveLength(COMMAND_RING_SIZE);
  });

  it("手元の seq がサーバより先(セッション作り直し等)なら resync", async () => {
    const { hub, host, creds } = await setup();
    const polled = await svc.poll(hub.deps, { ...creds(host), sinceSeq: 999, stateVersion: 0 });
    expect(polled.resync).toBe(true);
  });
});

describe("状態の公開", () => {
  it("ホストが公開すると version が増え、各端末は差分があるときだけ受け取る", async () => {
    const { hub, host, admin, client, creds } = await setup();
    expect((await svc.publishState(hub.deps, { ...creds(host), data: { screen: "opening" } })).version).toBe(1);
    expect((await svc.publishState(hub.deps, { ...creds(host), data: { screen: "draw" } })).version).toBe(2);

    const fresh = await svc.poll(hub.deps, { ...creds(client), sinceSeq: 0, stateVersion: 0 });
    expect(fresh.state?.data).toEqual({ screen: "draw" });
    expect(fresh.head.stateVersion).toBe(2);
    const same = await svc.poll(hub.deps, { ...creds(admin), sinceSeq: 0, stateVersion: 2 });
    expect(same.state).toBeNull();
  });

  it("ホスト以外・現ホストでない端末は公開できない", async () => {
    const { hub, admin, client, creds } = await setup();
    expect(await code(svc.publishState(hub.deps, { ...creds(admin), data: {} }))).toBe("NOT_HOST");
    expect(await code(svc.publishState(hub.deps, { ...creds(client), data: {} }))).toBe("NOT_HOST");
  });

  it("サイズ超過・形式不正を拒否する", async () => {
    const { hub, host, creds } = await setup();
    expect(await code(svc.publishState(hub.deps, { ...creds(host), data: { big: "x".repeat(MAX_STATE_BYTES) } }))).toBe("PAYLOAD_TOO_LARGE");
    expect(await code(svc.publishState(hub.deps, { ...creds(host), data: [] as never }))).toBe("INVALID_ARGUMENT");
    expect(await code(svc.publishState(hub.deps, { ...creds(host), data: {}, clientInput: ["bad key"] }))).toBe("INVALID_ARGUMENT");
  });

  it("状態未公開の間は state が null", async () => {
    const { hub, client, creds } = await setup();
    const polled = await svc.poll(hub.deps, { ...creds(client), sinceSeq: 0, stateVersion: 0 });
    expect(polled.state).toBeNull();
    expect(polled.head.stateVersion).toBe(0);
  });
});

describe("在席(presence)と間隔の指示", () => {
  it("ホストのack・管理の在席・参加者数を返す", async () => {
    const { hub, host, admin, client, creds } = await setup();
    await svc.poll(hub.deps, { ...creds(host), sinceSeq: 0, stateVersion: 0, ackSeq: 5 });
    await svc.joinClient(hub.deps, { code: (await hub.deps.repoFor(admin.session.id).getMeta())!.code, label: "花子" });
    const polled = await svc.poll(hub.deps, { ...creds(client), sinceSeq: 0, stateVersion: 0 });
    expect(polled.presence.host).toMatchObject({ deviceId: host.deviceId, ackSeq: 5, label: "体育館PC" });
    expect(polled.presence.admins.map((a) => a.label)).toEqual(["スマホ"]);
    expect(polled.presence.clientCount).toBe(2);
  });

  it("一定時間来ない管理・参加者は在席から外れる", async () => {
    const { hub, host, creds } = await setup();
    hub.clock.advance(5 * 60 * 1000);
    const polled = await svc.poll(hub.deps, { ...creds(host), sinceSeq: 0, stateVersion: 0 });
    expect(polled.presence.admins).toEqual([]);
    expect(polled.presence.clientCount).toBe(0);
  });

  it("活動直後は短く、静かになるほど間隔を延ばす(役割ごとの上限内)", async () => {
    const { hub, admin, client, creds } = await setup();
    await svc.issueCommand(hub.deps, { ...creds(admin), requestId: "r1", game: "jackpot", type: "advance" });
    const active = await svc.poll(hub.deps, { ...creds(client), sinceSeq: 0, stateVersion: 0 });
    expect(active.nextPollMs).toBe(3000);
    hub.clock.advance(10 * 60 * 1000);
    const idle = await svc.poll(hub.deps, { ...creds(client), sinceSeq: 0, stateVersion: 0 });
    expect(idle.nextPollMs).toBe(15000);
    const idleAdmin = await svc.poll(hub.deps, { ...creds(admin), sinceSeq: 1, stateVersion: 0 });
    expect(idleAdmin.nextPollMs).toBe(6000);
  });
});

describe("ストレージ操作回数(クォータ予算)", () => {
  it("定常状態のポーリングはKVを書かず、読みは認証(meta,device)+head の3回以内", async () => {
    const { hub, host, creds } = await setup();
    await svc.poll(hub.deps, { ...creds(host), sinceSeq: 0, stateVersion: 0 });
    hub.resetCounts();
    await svc.poll(hub.deps, { ...creds(host), sinceSeq: 0, stateVersion: 0 });
    expect(hub.counts.kvSet).toBe(0);
    expect(hub.counts.kvGet).toBeLessThanOrEqual(3);
    expect(hub.counts.lock).toBe(0);
    expect(hub.counts.cacheGet).toBe(1);
  });

  it("在席の書き込みは端末あたり10秒に1回程度に間引かれる", async () => {
    const { hub, client, creds } = await setup();
    hub.resetCounts();
    for (let i = 0; i < 5; i++) {
      hub.clock.advance(1000);
      await svc.poll(hub.deps, { ...creds(client), sinceSeq: 0, stateVersion: 0 });
    }
    expect(hub.counts.cachePut).toBe(0);
    hub.clock.advance(10_000);
    await svc.poll(hub.deps, { ...creds(client), sinceSeq: 0, stateVersion: 0 });
    expect(hub.counts.cachePut).toBe(1);
  });

  it("コマンド1件の発行はKV書き込み2回(コマンド本体とhead)", async () => {
    const { hub, admin, creds } = await setup();
    hub.resetCounts();
    await svc.issueCommand(hub.deps, { ...creds(admin), requestId: "r1", game: "jackpot", type: "advance" });
    expect(hub.counts.kvSet).toBe(2);
    expect(hub.counts.lock).toBe(1);
  });
});
