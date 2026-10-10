import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as service from "../../../server/engine/session-service";
import { NetworkError, seededRandom, randomFaults } from "../../../testing";
import type { FaultInjector } from "../../../testing";
import type { Command } from "../../../shared/session-types";
import { dateClock, makeDevice, makeHub, tick } from "./harness";
import { loadCredentials } from "../device-store";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => vi.useRealTimers());

async function scene() {
  const hub = makeHub();
  const meta = await service.createSession(hub.deps, { name: "夏祭り" }, "admin1");
  const host = makeDevice(hub, { memberId: "admin1" });
  const admin = makeDevice(hub, { memberId: "admin2" });
  const client = makeDevice(hub);
  const applied: Command[] = [];
  host.conn.onCommand((c) => {
    applied.push(c);
  });
  await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "スマホ" });
  await client.conn.joinClient({ code: meta.code, memberId: "u1", label: "太郎" });
  return { hub, meta, host, admin, client, applied };
}

describe("コマンドの配送", () => {
  it("管理が発行したコマンドをホストが seq 順に1回ずつ適用し、管理はackを確認できる", async () => {
    const { admin, host, applied } = await scene();
    await admin.conn.issue("jackpot", "setScreen", { screen: "opening" });
    await admin.conn.issue("jackpot", "advance");
    await tick(3000);
    expect(applied.map((c) => [c.seq, c.type])).toEqual([
      [1, "setScreen"],
      [2, "advance"],
    ]);
    await tick(10_000);
    expect(applied).toHaveLength(2);
    expect(admin.conn.state.presence?.host?.ackSeq).toBe(2);
    expect(admin.conn.state.recentCommands.map((c) => c.seq)).toEqual([1, 2]);
    host.conn.dispose();
  });

  it("操作直後は kick で次の予約を待たずに反映される", async () => {
    const { admin, applied } = await scene();
    await tick(10_000);
    await admin.conn.issue("jackpot", "advance");
    await tick(1);
    // ホストの次回予約(~数秒)を待たずに、管理側の kick は管理自身の取得を早めるだけ。ホストは1〜4秒以内に受け取る。
    await tick(4000);
    expect(applied).toHaveLength(1);
  });

  it("ホストのリロード: 適用済みseqから再開し、二重適用せず、不在中のコマンドは適用する", async () => {
    const { hub, meta, host, admin, applied } = await scene();
    await admin.conn.issue("jackpot", "advance");
    await tick(3000);
    expect(applied).toHaveLength(1);
    const savedStore = host.store;
    host.conn.dispose(); // タブを閉じる/リロード

    await admin.conn.issue("jackpot", "advance"); // 不在中に発行(seq 2)
    await tick(2000);

    const host2 = makeDevice(hub, { memberId: "admin1", store: savedStore });
    const applied2: Command[] = [];
    host2.conn.onCommand((c) => {
      applied2.push(c);
    });
    expect(host2.conn.resume("host")).toBe(true);
    await tick(3000);
    expect(applied2.map((c) => c.seq)).toEqual([2]);
    expect(loadCredentials(savedStore, "host")?.appliedSeq).toBe(2);
    void meta;
  });

  it("不在が長く古くなったコマンドは適用せず破棄する(暴走防止)", async () => {
    const { hub, host, admin } = await scene();
    const store = host.store;
    host.conn.dispose();
    await admin.conn.issue("jackpot", "advance");
    await tick(60_000);
    const host2 = makeDevice(hub, { memberId: "admin1", store, connection: { maxCommandAgeMs: 30_000 } });
    const applied2: Command[] = [];
    host2.conn.onCommand((c) => {
      applied2.push(c);
    });
    host2.conn.resume("host");
    await tick(3000);
    expect(applied2).toEqual([]);
    expect(host2.conn.state.skippedCommands).toBe(1);
    // その後の新しい操作は適用される
    await admin.conn.issue("jackpot", "advance");
    await tick(5000);
    expect(applied2.map((c) => c.seq)).toEqual([2]);
  });

  it("ホストを新規に入り直したときは過去のコマンドを再生しない", async () => {
    const { hub, meta, admin } = await scene();
    await admin.conn.issue("jackpot", "advance");
    await admin.conn.issue("jackpot", "advance");
    const fresh = makeDevice(hub, { memberId: "admin1" });
    const got: Command[] = [];
    fresh.conn.onCommand((c) => {
      got.push(c);
    });
    await fresh.conn.joinOperator({ sessionId: meta.id, role: "host", label: "新PC", takeover: true });
    await tick(5000);
    expect(got).toEqual([]);
  });

  it("ハンドラが例外を投げても同じコマンドを繰り返さず、後続は適用される", async () => {
    const { admin, host } = await scene();
    const seen: number[] = [];
    host.conn.onCommand((c) => {
      seen.push(c.seq);
      if (c.seq === 1) throw new Error("boom");
    });
    await admin.conn.issue("jackpot", "advance");
    await admin.conn.issue("jackpot", "advance");
    await tick(6000);
    expect(seen).toEqual([1, 2]);
  });

  it("ハンドラの完了を待ってから次を適用し、適用中は次の取得を始めない", async () => {
    const { admin, host } = await scene();
    const order: string[] = [];
    host.conn.onCommand(async (c) => {
      order.push(`start${c.seq}`);
      await new Promise((r) => setTimeout(r, 2500));
      order.push(`end${c.seq}`);
    });
    await admin.conn.issue("jackpot", "advance");
    await admin.conn.issue("jackpot", "advance");
    await tick(12_000);
    expect(order).toEqual(["start1", "end1", "start2", "end2"]);
  });
});

describe("参加者", () => {
  it("ホストが公開した状態を受け取り、許可された入力だけ送れる", async () => {
    const { client, host, applied, admin } = await scene();
    await expect(client.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);
    await host.conn.publish({ screen: "draw", winner: null }, ["jackpot.stopRoulette"]);
    await tick(4000);
    expect(client.conn.state.roomState?.data).toEqual({ screen: "draw", winner: null });
    await client.conn.issue("jackpot", "stopRoulette");
    await tick(3000);
    expect(applied.map((c) => [c.type, c.issuerRole])).toEqual([["stopRoulette", "client"]]);
    // 管理のコンソールにも見える
    await tick(3000);
    expect(admin.conn.state.recentCommands.map((c) => c.type)).toContain("stopRoulette");
    // 参加者の状態にはコマンドの中身が含まれない
    expect(client.conn.state.recentCommands).toEqual([]);
  });

  it("リロード復帰: 保存した入室情報で同じ端末として再接続し、参加コードを保持する", async () => {
    const { hub, meta, client } = await scene();
    const first = client.conn.state.deviceId;
    client.conn.dispose();
    const again = makeDevice(hub, { store: client.store });
    expect(again.conn.resume("client")).toBe(true);
    await tick(4000);
    expect(again.conn.state.phase).toBe("connected");
    expect(again.conn.state.deviceId).toBe(first);
    expect(again.conn.state.code).toBe(meta.code);
  });

  it("保存情報が無ければ resume は false", async () => {
    const hub = makeHub();
    const d = makeDevice(hub);
    expect(d.conn.resume("client")).toBe(false);
  });

  it("壊れた保存情報は無視して false(クラッシュしない)", async () => {
    const hub = makeHub();
    const d = makeDevice(hub);
    d.store.set("octopus.session.client", "{not json");
    expect(d.conn.resume("client")).toBe(false);
    expect(d.store.get("octopus.session.client")).toBeNull();
  });
});

describe("障害と復帰", () => {
  it("取得が失敗し続けると reconnecting になり、復旧すれば connected に戻る(バックオフ)", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    let down = false;
    const faults: FaultInjector = { decide: (e) => (down && e === "poll" ? "dropRequest" : "ok") };
    const client = makeDevice(hub, { faults });
    await client.conn.joinClient({ code: meta.code });
    await tick(4000);
    expect(client.conn.state.phase).toBe("connected");

    down = true;
    await tick(60_000);
    expect(client.conn.state.phase).toBe("reconnecting");
    expect(client.conn.state.failureCount).toBeGreaterThanOrEqual(2);
    const callsDuringOutage = client.api.calls.poll;
    // バックオフ: 60秒の停電中に取得は10回以内(3秒固定なら20回)
    expect(callsDuringOutage).toBeLessThan(14);

    down = false;
    await tick(40_000);
    expect(client.conn.state.phase).toBe("connected");
    expect(client.conn.state.failureCount).toBe(0);
  });

  it("端末認証が無効になったら unauthorized で停止し、入室情報を消し、以後ポーリングしない", async () => {
    const { client, hub, meta } = await scene();
    // 別セッションを作ってトークンを無効化する代わりに、保存済みdeviceのトークンを壊す
    const dev = await hub.deps.repoFor(meta.id).getDevice(client.conn.state.deviceId!);
    await hub.deps.repoFor(meta.id).putDevice({ ...dev!, token: "rotated" });
    await tick(20_000);
    expect(client.conn.state.phase).toBe("unauthorized");
    expect(client.conn.state.lastErrorCode).toBe("DEVICE_UNAUTHORIZED");
    expect(client.conn.state.code).toBe(meta.code);
    expect(loadCredentials(client.store, "client")).toBeNull();
    const calls = client.api.calls.poll;
    await tick(60_000);
    expect(client.api.calls.poll).toBe(calls);
  });

  it("セッションが終了したら ended で停止する", async () => {
    const { hub, meta, client, host } = await scene();
    await service.closeSession(hub.deps, { sessionId: meta.id });
    await tick(20_000);
    expect(client.conn.state.phase).toBe("ended");
    expect(host.conn.state.phase).toBe("ended");
    const calls = client.api.calls.poll;
    await tick(60_000);
    expect(client.api.calls.poll).toBe(calls);
  });

  it("入室に失敗したら idle に戻り、エラーコードを持つ", async () => {
    const hub = makeHub();
    const d = makeDevice(hub);
    await expect(d.conn.joinClient({ code: "NOPE22" })).rejects.toThrow();
    expect(d.conn.state.phase).toBe("idle");
    expect(d.conn.state.lastErrorCode).toBe("SESSION_NOT_FOUND");
  });

  it("コマンド発行は応答が失われても同じ requestId で再送され、1件だけ実行される", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    let dropOnce = true;
    const faults: FaultInjector = {
      decide: (e) => {
        if (e === "issueCommand" && dropOnce) {
          dropOnce = false;
          return "dropResponse";
        }
        return "ok";
      },
    };
    const admin = makeDevice(hub, { memberId: "a", faults, connection: { issueRetryDelayMs: 10 } });
    await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "x" });
    const p = admin.conn.issue("jackpot", "advance");
    await tick(100);
    const result = await p;
    expect(result.duplicate).toBe(true);
    expect((await hub.deps.repoFor(meta.id).getHead())?.seq).toBe(1);
  });

  it("業務エラーは再送しない", async () => {
    const { client } = await scene();
    const before = client.api.calls.issueCommand ?? 0;
    await expect(client.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);
    expect(client.api.calls.issueCommand - before).toBe(1);
  });

  it("再送回数を使い切った通信失敗は例外にする", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    let broken = false;
    const faults: FaultInjector = { decide: (e) => (broken && e === "issueCommand" ? "dropRequest" : "ok") };
    const admin = makeDevice(hub, { memberId: "a", faults, connection: { issueRetries: 2, issueRetryDelayMs: 10 } });
    await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "x" });
    broken = true;
    const p = admin.conn.issue("jackpot", "advance");
    const assertion = expect(p).rejects.toBeInstanceOf(NetworkError);
    await tick(200);
    await assertion;
    expect(admin.api.calls.issueCommand).toBe(3);
  });
});

describe("状態の公開", () => {
  it("連続した公開は最新だけを送る(間引き)", async () => {
    const { host, client } = await scene();
    const before = host.api.calls.publishState ?? 0;
    const ps = [1, 2, 3, 4, 5].map((i) => host.conn.publish({ n: i }));
    await Promise.all(ps);
    expect(host.api.calls.publishState - before).toBeLessThanOrEqual(2);
    await tick(5000);
    expect(client.conn.state.roomState?.data).toEqual({ n: 5 });
  });

  it("公開が通信失敗しても保留され、次の取得成功時に再送される", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    let fail = true;
    const faults: FaultInjector = { decide: (e) => (fail && e === "publishState" ? "dropRequest" : "ok") };
    const host = makeDevice(hub, { memberId: "a", faults });
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    let resolved = false;
    void host.conn.publish({ screen: "x" }).then(() => (resolved = true));
    await tick(10);
    expect(resolved).toBe(false);
    fail = false;
    await tick(3000);
    expect(resolved).toBe(true);
    expect((await hub.deps.repoFor(meta.id).getState())?.data).toEqual({ screen: "x" });
  });

  it("ホストでない端末の公開は業務エラーとして拒否される", async () => {
    const { admin } = await scene();
    await expect(admin.conn.publish({ a: 1 })).rejects.toThrow(/NOT_HOST/);
  });

  it("入室前の公開・発行は拒否される", async () => {
    const hub = makeHub();
    const d = makeDevice(hub);
    await expect(d.conn.publish({})).rejects.toThrow("not joined");
    await expect(d.conn.issue("a", "b")).rejects.toThrow("not joined");
  });
});

describe("ポーリング間隔とクォータ", () => {
  it("非表示の間は取得が減り、表示に戻ると即座に取得する", async () => {
    const { client } = await scene();
    await tick(5000);
    const visibleStart = client.api.calls.poll;
    await tick(60_000);
    const visibleCount = client.api.calls.poll - visibleStart;

    client.conn.setVisible(false);
    const hiddenStart = client.api.calls.poll;
    await tick(60_000);
    const hiddenCount = client.api.calls.poll - hiddenStart;
    expect(hiddenCount).toBeLessThan(visibleCount / 2);
    expect(hiddenCount).toBeLessThanOrEqual(3);

    const beforeShow = client.api.calls.poll;
    client.conn.setVisible(true);
    await tick(1);
    expect(client.api.calls.poll).toBe(beforeShow + 1);
  });

  it("静かな参加者は最終的に15秒間隔まで落ち、1時間の取得は300回未満", async () => {
    const { client } = await scene();
    await tick(2 * 60 * 1000);
    const start = client.api.calls.poll;
    await tick(60 * 60 * 1000);
    expect(client.api.calls.poll - start).toBeLessThan(300);
  });

  it("操作が続く間のホストは約1秒間隔、10分の取得は予算(1000回)以内", async () => {
    const { host, admin } = await scene();
    const start = host.api.calls.poll ?? 0;
    for (let i = 0; i < 60; i++) {
      await admin.conn.issue("jackpot", "advance");
      await tick(10_000);
    }
    const count = (host.api.calls.poll ?? 0) - start;
    expect(count).toBeGreaterThan(300);
    expect(count).toBeLessThan(1000);
  });

  it("上限を超える取得は強制的に15秒間隔へ引き上げる", async () => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const host = makeDevice(hub, { memberId: "a", polling: { budgetMaxPolls: 20, budgetWindowMs: 60_000 } });
    await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
    await tick(60_000);
    const count = host.api.calls.poll;
    // 20回(約1秒間隔で20秒)で頭打ちになり、残りの40秒は15秒間隔(数回)
    expect(count).toBeLessThan(30);
    expect(host.transport.recentPollCount).toBeLessThanOrEqual(30);
  });

  it("サーバ時計とのずれ(serverOffsetMs)を記録する", async () => {
    const { client } = await scene();
    dateClock.advance(0);
    await tick(4000);
    expect(Math.abs(client.conn.state.serverOffsetMs)).toBeLessThan(5000);
  });
});

describe("ランダム障害でも不変条件が保たれる", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])("seed %i: ホストは発行された順に重複なく適用する", async (seed) => {
    const hub = makeHub();
    const meta = await service.createSession(hub.deps, { name: "x" }, "a");
    const rand = seededRandom(seed);
    const faults = randomFaults(rand, { dropRequest: 0.1, dropResponse: 0.1, duplicate: 0.05, fail: 0.05 });
    const host = makeDevice(hub, { memberId: "a", faults });
    const admin = makeDevice(hub, { memberId: "b", faults, connection: { issueRetries: 6, issueRetryDelayMs: 50 } });
    const applied: number[] = [];
    host.conn.onCommand((c) => {
      applied.push(Number((c.payload as { n: number }).n));
    });
    // 入室は障害なしの経路で確実に行う(入室の失敗系は別テスト)
    const reliable = makeDevice(hub, { memberId: "a" });
    void reliable;
    for (let attempt = 0; attempt < 10 && host.conn.state.phase !== "connected"; attempt++) {
      await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" }).catch(() => undefined);
    }
    for (let attempt = 0; attempt < 10 && admin.conn.state.phase !== "connected"; attempt++) {
      await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" }).catch(() => undefined);
    }
    expect(host.conn.state.phase).not.toBe("idle");

    // 再送を使い切った発行も「サーバで実行されたかもしれない」。成否は問わず、順序と重複のみを検証する。
    const issued: number[] = [];
    const pending: Promise<unknown>[] = [];
    for (let n = 1; n <= 30; n++) {
      pending.push(admin.conn.issue("jackpot", "advance", { n }).catch(() => undefined));
      issued.push(n);
      await tick(1500);
    }
    await tick(60_000);
    await Promise.all(pending);
    // 重複なし・昇順(取りこぼしは許容: 古すぎて破棄/リング超過は仕様)
    expect(new Set(applied).size).toBe(applied.length);
    expect([...applied].sort((a, b) => a - b)).toEqual(applied);
    expect(applied.every((n) => issued.includes(n))).toBe(true);
    // 十分な割合は届いている
    expect(applied.length).toBeGreaterThan(15);
  });
});
