import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRpcBody, ensurePortalSession, pickReusableSession, withRetry } from "./seed-session.js";

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
