import { describe, expect, it } from "vitest";
import { createTestHub } from "../../../testing";
import * as svc from "../session-service";
import { parseHubErrorCode } from "../hub-error";
import { MAX_ROUND_ANSWERS_KV } from "../../../shared/session-types";
import type { JoinResult, RoundOption } from "../../../shared/protocol";

const OPTIONS: RoundOption[] = [
  { no: 1, text: "りんご" },
  { no: 2, text: "みかん" },
  { no: 3, text: "ぶどう" },
];

async function code(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (e) {
    return parseHubErrorCode((e as Error).message) ?? (e as Error).message;
  }
}

async function setup(clients = 1) {
  const hub = createTestHub();
  const meta = await svc.createSession(hub.deps, { name: "x" }, "a");
  const host = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "host", label: "PC" }, "a");
  const admin = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "admin", label: "A" }, "b");
  const players: JoinResult[] = [];
  for (let i = 0; i < clients; i++) {
    players.push(await svc.joinClient(hub.deps, { code: meta.code, memberId: `m${i}`, label: `参加者${i}` }));
  }
  const creds = (j: JoinResult) => ({ sessionId: meta.id, deviceId: j.deviceId, token: j.token });
  const open = (key = "q1:live", durationMs = 20_000, options = OPTIONS) =>
    svc.openRound(hub.deps, { ...creds(host), key, options, durationMs });
  return { hub, meta, host, admin, players, creds, open };
}

describe("openRound", () => {
  it("ホストが開始すると、サーバ時刻の締切が返る", async () => {
    const { hub, open } = await setup();
    const r = await open("q1:live", 20_000);
    expect(r.key).toBe("q1:live");
    expect(r.deadlineMs).toBe(r.serverNowMs + 20_000);
    expect(r.serverNowMs).toBe(hub.clock.now());
  });

  it("ホスト以外(管理・参加者・引き継がれた旧ホスト)は開始できない", async () => {
    const { hub, admin, players, creds } = await setup();
    const args = { key: "q1", options: OPTIONS, durationMs: 10_000 };
    expect(await code(svc.openRound(hub.deps, { ...creds(admin), ...args }))).toBe("NOT_HOST");
    expect(await code(svc.openRound(hub.deps, { ...creds(players[0]), ...args }))).toBe("NOT_HOST");
  });

  it("引き継がれた旧ホストは開始できない", async () => {
    const { hub, host, meta, creds } = await setup();
    await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "host", label: "新", takeover: true }, "a");
    expect(await code(svc.openRound(hub.deps, { ...creds(host), key: "q1", options: OPTIONS, durationMs: 10_000 }))).toBe("NOT_HOST");
  });

  it.each([
    ["key が空", { key: "" }],
    ["key に不正文字", { key: "bad key!" }],
    ["key が長すぎる", { key: "k".repeat(81) }],
    ["受付時間が短すぎる", { durationMs: 10 }],
    ["受付時間が長すぎる", { durationMs: 3_600_000 }],
    ["受付時間が数値でない", { durationMs: Number.NaN }],
    ["選択肢が1つ", { options: [{ no: 1, text: "a" }] }],
    ["選択肢が多すぎる", { options: Array.from({ length: 9 }, (_, i) => ({ no: i + 1, text: "a" })) }],
    ["番号が重複", { options: [{ no: 1, text: "a" }, { no: 1, text: "b" }] }],
    ["番号が0", { options: [{ no: 0, text: "a" }, { no: 1, text: "b" }] }],
    ["番号が小数", { options: [{ no: 1.5, text: "a" }, { no: 2, text: "b" }] }],
    ["選択肢の文字が長すぎる", { options: [{ no: 1, text: "あ".repeat(101) }, { no: 2, text: "b" }] }],
  ] as Array<[string, Record<string, unknown>]>)("不正な指定を拒否: %s", async (_name, override) => {
    const { hub, host, creds } = await setup();
    const args = { key: "q1", options: OPTIONS, durationMs: 10_000, ...override };
    const full = { ...creds(host), ...args } as unknown as Parameters<typeof svc.openRound>[1];
    expect(await code(svc.openRound(hub.deps, full))).toBe("INVALID_ARGUMENT");
  });

  it("同じラウンドが受付中なら再送は続きとして扱われ、回答は消えない(ホストのリロード)", async () => {
    const { hub, players, creds, open } = await setup();
    const first = await open("q1");
    await svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 2 });
    hub.clock.advance(3000);
    const again = await open("q1");
    expect(again.deadlineMs).toBe(first.deadlineMs); // 締切は延びない
    const host = (await hub.deps.repoFor(creds(players[0]).sessionId).getRound())!;
    expect(host.answerCount).toBe(1);
  });

  it("締切後・締切済みの同じ key は新しいラウンドとして始まり、前の回答は破棄される", async () => {
    const { hub, players, creds, open } = await setup();
    await open("q1", 5000);
    await svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 1 });
    hub.clock.advance(6000);
    await open("q1", 5000);
    const round = (await hub.deps.repoFor(creds(players[0]).sessionId).getRound())!;
    expect(round.answerCount).toBe(0);
    // 新しいラウンドでは同じ端末がもう一度回答できる
    await expect(svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 3 })).resolves.toMatchObject({ no: 3, duplicate: false });
  });

  it("別の key で始めると前のラウンドは置き換わる", async () => {
    const { hub, players, creds, open } = await setup();
    await open("q1");
    await open("q2");
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 1 }))).toBe("ROUND_NOT_OPEN");
    await expect(svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q2", no: 1 })).resolves.toBeDefined();
  });
});

describe("submitAnswer", () => {
  it("参加者は受付中に回答でき、サーバ時刻が記録される", async () => {
    const { hub, players, creds, open } = await setup();
    await open("q1");
    hub.clock.advance(1234);
    const r = await svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 2 });
    expect(r).toEqual({ no: 2, atMs: hub.clock.now(), duplicate: false });
  });

  it("先着で1人1回: 2回目以降は最初の回答のまま duplicate を返す", async () => {
    const { hub, players, creds, open } = await setup();
    await open("q1");
    await svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 1 });
    hub.clock.advance(500);
    const second = await svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 3 });
    expect(second).toMatchObject({ no: 1, duplicate: true });
  });

  it("締切後は ROUND_CLOSED。ただし回答済みの端末には最初の回答を返す(画面表示を揃える)", async () => {
    const { hub, players, creds, open } = await setup(2);
    await open("q1", 5000);
    await svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 2 });
    hub.clock.advance(5000); // ちょうど締切
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(players[1]), key: "q1", no: 1 }))).toBe("ROUND_CLOSED");
    expect(await svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 3 })).toMatchObject({ no: 2, duplicate: true });
  });

  it("締切の直前(1ms前)は受け付け、ちょうど締切は受け付けない(端末の時計ではなくサーバ時刻)", async () => {
    const { hub, players, creds, open } = await setup(2);
    await open("q1", 5000);
    hub.clock.advance(4999);
    await expect(svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 1 })).resolves.toBeDefined();
    hub.clock.advance(1);
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(players[1]), key: "q1", no: 1 }))).toBe("ROUND_CLOSED");
  });

  it("ホストが手動で締め切ると、締切時刻前でも受け付けない", async () => {
    const { hub, host, players, creds, open } = await setup();
    await open("q1", 60_000);
    await svc.closeRound(hub.deps, { ...creds(host), key: "q1" });
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 1 }))).toBe("ROUND_CLOSED");
  });

  it("ホストのタブが落ちて締め切られなくても、締切時刻が来れば自動で受付が終わる", async () => {
    const { hub, players, creds, open } = await setup();
    await open("q1", 20_000);
    hub.clock.advance(60_000); // ホストは何もしていない
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 1 }))).toBe("ROUND_CLOSED");
  });

  it("ラウンドが無い・key が違う場合は ROUND_NOT_OPEN", async () => {
    const { hub, players, creds, open } = await setup();
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 1 }))).toBe("ROUND_NOT_OPEN");
    await open("q1");
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "other", no: 1 }))).toBe("ROUND_NOT_OPEN");
  });

  it.each([0, 4, -1, 1.5, Number.NaN])("存在しない選択肢 %s は拒否", async (no) => {
    const { hub, players, creds, open } = await setup();
    await open("q1");
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no }))).toBe("INVALID_ARGUMENT");
  });

  it("参加者以外(ホスト・管理)は回答できない", async () => {
    const { hub, host, admin, creds, open } = await setup();
    await open("q1");
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(host), key: "q1", no: 1 }))).toBe("FORBIDDEN");
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(admin), key: "q1", no: 1 }))).toBe("FORBIDDEN");
  });

  it("認証できない端末は回答できない", async () => {
    const { hub, players, creds, open } = await setup();
    await open("q1");
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(players[0]), token: "x", key: "q1", no: 1 }))).toBe("DEVICE_UNAUTHORIZED");
  });

  it("同時に30人が回答しても、全員が1回ずつ記録される", async () => {
    const { hub, meta, players, creds, open } = await setup(30);
    await open("q1");
    const results = await Promise.all(players.map((p, i) => svc.submitAnswer(hub.deps, { ...creds(p), key: "q1", no: (i % 3) + 1 })));
    expect(results.every((r) => !r.duplicate)).toBe(true);
    expect((await hub.deps.repoFor(meta.id).getRound())!.answerCount).toBe(30);
    expect(await hub.deps.repoFor(meta.id).listAnswers("q1")).toHaveLength(30);
  });

  it("同じ端末の同時二重送信でも1件だけ採用される", async () => {
    const { hub, meta, players, creds, open } = await setup();
    await open("q1");
    const results = await Promise.all([1, 2, 3].map((no) => svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no })));
    expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(await hub.deps.repoFor(meta.id).listAnswers("q1")).toHaveLength(1);
  });

  it("KV 版の回答数の上限を超えると PAYLOAD_TOO_LARGE(GAS の1値の上限を守る)", async () => {
    const { hub, players, creds, open } = await setup(MAX_ROUND_ANSWERS_KV + 1);
    await open("q1");
    for (const p of players.slice(0, MAX_ROUND_ANSWERS_KV)) {
      await svc.submitAnswer(hub.deps, { ...creds(p), key: "q1", no: 1 });
    }
    expect(await code(svc.submitAnswer(hub.deps, { ...creds(players[MAX_ROUND_ANSWERS_KV]), key: "q1", no: 1 }))).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("closeRound / getAnswers", () => {
  it("ホスト・管理は締め切れる。締切は冪等で、参加者は締め切れない", async () => {
    const { hub, host, admin, players, creds, open } = await setup();
    await open("q1", 60_000);
    expect(await code(svc.closeRound(hub.deps, { ...creds(players[0]), key: "q1" }))).toBe("FORBIDDEN");
    const a = await svc.closeRound(hub.deps, { ...creds(admin), key: "q1" });
    expect(a.open).toBe(false);
    const b = await svc.closeRound(hub.deps, { ...creds(host), key: "q1" });
    expect(b.open).toBe(false);
  });

  it("存在しないラウンドの締切は ROUND_NOT_OPEN", async () => {
    const { hub, host, creds } = await setup();
    expect(await code(svc.closeRound(hub.deps, { ...creds(host), key: "q1" }))).toBe("ROUND_NOT_OPEN");
  });

  it("回答一覧は回答順で、メンバー・表示名・番号・時刻を含み、締切後も取得できる", async () => {
    const { hub, host, players, creds, open } = await setup(3);
    await open("q1", 10_000);
    for (const [i, p] of [players[2], players[0], players[1]].entries()) {
      hub.clock.advance(100);
      await svc.submitAnswer(hub.deps, { ...creds(p), key: "q1", no: i + 1 });
    }
    hub.clock.advance(20_000);
    const result = await svc.getAnswers(hub.deps, { ...creds(host), key: "q1" });
    expect(result.round).toMatchObject({ key: "q1", open: false, answerCount: 3 });
    expect(result.answers.map((a) => [a.label, a.memberId, a.no])).toEqual([
      ["参加者2", "m2", 1],
      ["参加者0", "m0", 2],
      ["参加者1", "m1", 3],
    ]);
    expect(result.answers.map((a) => a.atMs)).toEqual([...result.answers.map((a) => a.atMs)].sort((x, y) => x - y));
  });

  it("参加者は回答一覧を取得できず、key が違えば ROUND_NOT_OPEN", async () => {
    const { hub, host, players, creds, open } = await setup();
    await open("q1");
    expect(await code(svc.getAnswers(hub.deps, { ...creds(players[0]), key: "q1" }))).toBe("FORBIDDEN");
    expect(await code(svc.getAnswers(hub.deps, { ...creds(host), key: "zzz" }))).toBe("ROUND_NOT_OPEN");
  });
});

describe("pollへのラウンド要約", () => {
  it("ホスト・管理にだけ回答数が届き、参加者には届かない。ラウンド開始前は null", async () => {
    const { hub, host, admin, players, creds, open } = await setup();
    const poll = (j: JoinResult) => svc.poll(hub.deps, { ...creds(j), sinceSeq: 0, stateVersion: 0 });
    expect((await poll(host)).round).toBeNull();
    await open("q1", 20_000);
    await svc.submitAnswer(hub.deps, { ...creds(players[0]), key: "q1", no: 2 });
    expect((await poll(host)).round).toMatchObject({ key: "q1", open: true, answerCount: 1 });
    expect((await poll(admin)).round).toMatchObject({ answerCount: 1 });
    expect((await poll(players[0])).round).toBeNull();
    hub.clock.advance(30_000);
    expect((await poll(host)).round).toMatchObject({ open: false });
  });

  it("ラウンドが一度も開かれていない間は、ポーリングの読み取りが増えない", async () => {
    const { hub, host, creds } = await setup();
    await svc.poll(hub.deps, { ...creds(host), sinceSeq: 0, stateVersion: 0 });
    hub.resetCounts();
    await svc.poll(hub.deps, { ...creds(host), sinceSeq: 0, stateVersion: 0 });
    expect(hub.counts.kvGet).toBeLessThanOrEqual(3);
  });
});
