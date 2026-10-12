import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoResults, buildRpcBody, ensurePortalSession, pickReusableSession, seedDemoResults, withRetry } from "./seed-session.js";

const noSleep = async () => {};

/** /rpc の呼び出しを記録し、名前ごとに決めた応答を返す偽 fetch。 */
function fakeFetch(handlers) {
  const calls = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, name: body.name, args: body.args.args, token: body.args.__octopusAuth });
    const data = handlers[body.name](body.args.args);
    return { json: async () => ({ status: "success", data }) };
  };
  return { fetch, calls };
}

test("buildRpcBody: 管理者トークンを __octopusAuth に入れる", () => {
  assert.deepEqual(buildRpcBody("sessionHub_listSessions", undefined, "tok"), { name: "sessionHub_listSessions", args: { __octopusAuth: "tok", args: undefined } });
});

test("pickReusableSession: 同名で終了前のうち新しいものを選ぶ", () => {
  const list = [
    { id: "a", name: "X", status: "closed", createdAtMs: 3 },
    { id: "b", name: "X", status: "lobby", createdAtMs: 1 },
    { id: "c", name: "X", status: "live", createdAtMs: 2 },
    { id: "d", name: "Y", status: "live", createdAtMs: 9 },
  ];
  assert.equal(pickReusableSession(list, "X").id, "c");
  assert.equal(pickReusableSession(list, "Z"), undefined);
});

test("ensurePortalSession: 無ければ作成してポータルに公開する", async () => {
  const { fetch, calls } = fakeFetch({
    sessionHub_listSessions: () => [],
    sessionHub_createSession: (a) => ({ id: "s1", code: "ABC123", name: a.name }),
    sessionHub_setPortalSession: () => null,
  });
  const result = await ensurePortalSession({ fetch, baseUrl: "https://x.example/", token: "tok", name: "N", sleep: noSleep });
  assert.deepEqual(result, { id: "s1", code: "ABC123", name: "N", reused: false });
  assert.deepEqual(calls.map((c) => c.name), ["sessionHub_listSessions", "sessionHub_createSession", "sessionHub_setPortalSession"]);
  assert.equal(calls[0].url, "https://x.example/rpc");
  assert.deepEqual(calls[1].args, { name: "N", mode: "live" });
  assert.deepEqual(calls[2].args, { sessionId: "s1", published: true });
  assert.ok(calls.every((c) => c.token === "tok"));
});

test("ensurePortalSession: 使えるセッションがあれば作らず、公開し直すだけ", async () => {
  const { fetch, calls } = fakeFetch({
    sessionHub_listSessions: () => [{ id: "old", code: "QQQ111", name: "N", status: "live", createdAtMs: 1 }],
    sessionHub_createSession: () => assert.fail("作成してはいけない"),
    sessionHub_setPortalSession: () => null,
  });
  const result = await ensurePortalSession({ fetch, baseUrl: "https://x.example", token: "tok", name: "N", sleep: noSleep });
  assert.equal(result.reused, true);
  assert.equal(result.id, "old");
  assert.deepEqual(calls.map((c) => c.name), ["sessionHub_listSessions", "sessionHub_setPortalSession"]);
});

test("withRetry: 失敗したら待って再試行し、上限で諦める", async () => {
  let n = 0;
  assert.equal(
    await withRetry(async () => {
      if (++n < 3) throw new Error("not yet");
      return "ok";
    }, { sleep: noSleep }),
    "ok"
  );
  let m = 0;
  await assert.rejects(
    () =>
      withRetry(async () => {
        m++;
        throw new Error("always");
      }, { attempts: 3, sleep: noSleep }),
    /always/
  );
  assert.equal(m, 3);
});

const PARTICIPANTS = Array.from({ length: 20 }, (_, i) => `test-user-${String(i + 1).padStart(2, "0")}`);

test("buildDemoResults: クイズ3ラウンド・抽選5件を、サンプルだとわかる ID で作る(決定的)", () => {
  const a = buildDemoResults(PARTICIPANTS, 1_700_000_000_000);
  assert.deepEqual(a, buildDemoResults(PARTICIPANTS, 1_700_000_000_000));
  assert.equal(a.rounds.length, 3);
  assert.equal(a.draws.length, 5);
  assert.ok(a.rounds.every((r) => r.roundKey.startsWith("seed-demo-")));
  assert.ok(a.draws.every((d) => d.drawId.startsWith("seed-demo-")));
  assert.equal(new Set(a.draws.map((d) => d.drawId)).size, 5);
});

test("buildDemoResults: 順位表として成り立つ(早い順・正解/不正解が重ならない・十分な人数)", () => {
  const { rounds, draws } = buildDemoResults(PARTICIPANTS, 1_700_000_000_000);
  for (const r of rounds) {
    assert.ok(r.correct.length >= 5, `${r.title}: 正解者が少ない`);
    assert.deepEqual(r.correct.map((c) => c.sec), [...r.correct.map((c) => c.sec)].sort((x, y) => x - y));
    const correctIds = new Set(r.correct.map((c) => c.memberId));
    assert.ok(r.wrongMemberIds.every((id) => !correctIds.has(id)));
    assert.equal(r.answeredCount, r.correct.length + r.wrongMemberIds.length);
    assert.ok(r.correct.every((c) => /^テスト参加者\d+$/.test(c.name) && c.memberId.startsWith("test-user-")));
  }
  assert.ok(rounds[0].closedAtMs < rounds[2].closedAtMs);
  assert.ok(draws.every((d) => d.prizeName && d.memberName && Number.isFinite(d.atMs)));
  assert.ok(draws.some((d) => d.isKakuhen));
});

test("buildDemoResults: 参加者が少なくても作れる(存在しない人を当選にしない)", () => {
  const { rounds, draws } = buildDemoResults(PARTICIPANTS.slice(0, 5), 1);
  assert.equal(rounds.length, 3);
  assert.ok(draws.length >= 1 && draws.length <= 5);
  assert.ok(draws.every((d) => PARTICIPANTS.slice(0, 5).includes(d.memberId)));
});

test("seedDemoResults: ラウンドと抽選を管理者トークンで保存する", async () => {
  const { fetch, calls } = fakeFetch({
    sessionHub_putQuizResult: () => ({ rev: 1 }),
    sessionHub_putJackpotDraw: () => ({ rev: 2 }),
  });
  const done = await seedDemoResults({ fetch, baseUrl: "https://x.example/", token: "tok", sessionId: "s1", participantIds: PARTICIPANTS, now: 1_700_000_000_000, sleep: noSleep });
  assert.deepEqual(done, { rounds: 3, draws: 5 });
  assert.equal(calls.filter((c) => c.name === "sessionHub_putQuizResult").length, 3);
  assert.equal(calls.filter((c) => c.name === "sessionHub_putJackpotDraw").length, 5);
  assert.ok(calls.every((c) => c.token === "tok" && c.args.sessionId === "s1"));
});
