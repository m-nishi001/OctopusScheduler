import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, qrLoginUrl, renderBanner, stackPaths } from "./dev-stack.js";

test("parseArgs: 既定値とオプション", () => {
  assert.deepEqual(parseArgs([]), { reset: false, port: undefined, count: undefined });
  assert.deepEqual(parseArgs(["--port", "8800", "--count", "10", "--reset"]), { reset: true, port: 8800, count: 10 });
});

test("parseArgs: 不正な値や不明な引数は拒否する", () => {
  assert.throws(() => parseArgs(["--port", "abc"]));
  assert.throws(() => parseArgs(["--count", "0"]));
  assert.throws(() => parseArgs(["--bogus"]));
});

test("stackPaths: 状態は root 配下の .wrangler/dev-stack に置く(gitignore 済み)", () => {
  const p = stackPaths("/repo");
  assert.equal(p.dir, "/repo/.wrangler/dev-stack");
  assert.equal(p.config, "/repo/.wrangler/dev-stack/wrangler.toml");
  assert.equal(p.state, "/repo/.wrangler/dev-stack/state");
});

test("renderBanner: URL・管理者・参加者の範囲が出る", () => {
  const text = renderBanner({
    base: "http://127.0.0.1:8800",
    seed: {
      admin: { id: "admin", password: "pw-admin", sessionToken: "tok" },
      participants: { ids: ["test-user-01", "test-user-02"], password: "pw-user", loginKeys: { "test-user-01": "key01" } },
    },
  });
  assert.match(text, /http:\/\/127\.0\.0\.1:8800\//);
  assert.match(text, /admin.*pw-admin/);
  assert.match(text, /test-user-01 〜 test-user-02（?\(?2名/);
  assert.match(text, /pw-user/);
  assert.match(text, /\/#\/login\?id=test-user-01&key=key01/);
});

test("qrLoginUrl: キーはフラグメントに入れ、キーが無ければ案内を出す", () => {
  assert.equal(qrLoginUrl("http://h", "a b", "k&1"), "http://h/#/login?id=a%20b&key=k%261");
  assert.equal(qrLoginUrl("http://h", "a", undefined), "(キーなし)");
});
