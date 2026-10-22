import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertNotProduction, ensureLifecycle, ensureLifecycleAsync, isTransientAuthError, lifecycleArgs, parseDeployUrl, renderTimings, parseSeedArgs, renderUpSummary, runWithRetry, runWithRetryAsync, STAGING, toStagingTemplate } from "./staging.js";

const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../wrangler.example.toml"), "utf8");

test("toStagingTemplate: Worker 名とレート制限の namespace_id を本番と分ける", () => {
  const out = toStagingTemplate(template);
  assert.match(out, /^name = "octopus-scheduler-staging"$/m);
  assert.ok(!out.includes('namespace_id = "1001"') && !out.includes('namespace_id = "1002"'));
  assert.ok(out.includes('namespace_id = "2001"') && out.includes('namespace_id = "2002"'));
});

test("toStagingTemplate: プレースホルダと Durable Object の設定は残す", () => {
  const out = toStagingTemplate(template);
  assert.match(out, /REPLACE_WITH_YOUR_D1_DATABASE_ID/);
  assert.match(out, /SESSION_ROOM/);
  assert.match(out, /new_sqlite_classes/);
});

test("assertNotProduction: staging の名前は通り、本番と同じ名前は拒否する", () => {
  assert.doesNotThrow(() => assertNotProduction(STAGING));
  assert.throws(() => assertNotProduction({ ...STAGING, bucket: "octopus-scheduler-assets" }));
  assert.throws(() => assertNotProduction({ ...STAGING, workerName: "octopus-scheduler" }));
});

test("parseDeployUrl: デプロイ出力から workers.dev の URL を取り出す", () => {
  const out = "Uploaded octopus-scheduler-staging\nDeployed octopus-scheduler-staging triggers\n  https://octopus-scheduler-staging.example-sub.workers.dev\nCurrent Version ID: x";
  assert.equal(parseDeployUrl(out), "https://octopus-scheduler-staging.example-sub.workers.dev");
  assert.equal(parseDeployUrl("no url"), null);
});

test("renderUpSummary: Playwright を向けるコマンドと撤去の案内を含む", () => {
  const text = renderUpSummary({
    url: "https://x.workers.dev",
    seed: { admin: { id: "admin", password: "pw", sessionToken: "tok" }, participants: { ids: ["test-user-01", "test-user-20"], password: "pu", loginKeys: { "test-user-01": "k01" } } },
  });
  assert.match(text, /BASE=https:\/\/x\.workers\.dev/);
  assert.match(text, /E2E_ADMIN_TOKEN=tok/);
  assert.match(text, /staging:down/);
  assert.match(text, /https:\/\/x\.workers\.dev\/#\/login\?id=test-user-01&key=k01/);
});

test("renderUpSummary: 結果データの投入有無を要約に正しく出す(既定は含まない)", () => {
  const base = {
    url: "https://x.workers.dev",
    seed: { admin: { id: "admin", password: "pw", sessionToken: "tok" }, participants: { ids: ["test-user-01"], password: "pu" } },
    session: { name: "S", code: "123456", reused: false },
  };
  assert.match(renderUpSummary(base), /結果データは投入していません/);
  assert.doesNotMatch(renderUpSummary(base), /サンプルの順位・当選履歴を投入済み/);
  assert.match(renderUpSummary({ ...base, withResults: true }), /サンプルの順位・当選履歴を投入済み/);
});

test("parseSeedArgs: 既定は結果を含まず、--with-results で含む。不明なフラグは拒否する", () => {
  assert.deepEqual(parseSeedArgs([]), { withResults: false, positional: [] });
  assert.deepEqual(parseSeedArgs(["https://x.dev", "--with-results"]), { withResults: true, positional: ["https://x.dev"] });
  assert.throws(() => parseSeedArgs(["--bogus"]), /不明な引数/);
});

test("lifecycleArgs: staging のバケットに1日で自動削除するルールを付ける", () => {
  const args = lifecycleArgs("b");
  assert.deepEqual(args.slice(0, 5), ["r2", "bucket", "lifecycle", "add", "b"]);
  assert.equal(args[args.indexOf("--expire-days") + 1], "1");
  assert.ok(args.includes("--force"));
});

test("ensureLifecycle: 既にルールがある失敗は無視し、それ以外は例外にする", () => {
  const fail = (message) => () => {
    throw new Error(message);
  };
  assert.doesNotThrow(() => ensureLifecycle(fail("A rule with this name already exists"), "b"));
  // 実際の Cloudflare の文言(実環境で確認)
  assert.doesNotThrow(() => ensureLifecycle(fail("Invalid Lifecycle Configuration: Rule IDs must be unique. [code: 10061]"), "b"));
  assert.throws(() => ensureLifecycle(fail("Authentication error"), "b"), /Authentication/);
  let called;
  ensureLifecycle((a) => (called = a), "b");
  assert.deepEqual(called, lifecycleArgs("b"));
});

test("isTransientAuthError: Cloudflare の一時的な認証エラー(10000)だけを見分ける", () => {
  assert.ok(isTransientAuthError("Authentication error [code: 10000]"));
  assert.ok(!isTransientAuthError("Authentication error [code: 10001]"));
  assert.ok(!isTransientAuthError("Rule IDs must be unique"));
});

test("runWithRetry: 一時的な認証エラーなら待って再実行し、成功すれば結果を返す", () => {
  let calls = 0;
  const waits = [];
  const result = runWithRetry(
    () => {
      if (++calls < 3) throw Object.assign(new Error("x"), { stderr: "Authentication error [code: 10000]" });
      return "ok";
    },
    { sleep: (ms) => waits.push(ms) }
  );
  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.deepEqual(waits, [2000, 4000]);
});

test("runWithRetry: 上限回数で諦め、それ以外のエラーは再実行せずそのまま投げる", () => {
  let calls = 0;
  const transient = () => {
    calls++;
    throw Object.assign(new Error("x"), { stderr: "Authentication error [code: 10000]" });
  };
  assert.throws(() => runWithRetry(transient, { attempts: 3, sleep: () => {} }), /x/);
  assert.equal(calls, 3);

  let other = 0;
  assert.throws(
    () =>
      runWithRetry(
        () => {
          other++;
          throw new Error("Rule IDs must be unique");
        },
        { sleep: () => {} }
      ),
    /unique/
  );
  assert.equal(other, 1);
});

test("ensureLifecycleAsync: 既にルールがある失敗は無視し、それ以外は例外にする", async () => {
  const fail = (message) => async () => {
    throw new Error(message);
  };
  await ensureLifecycleAsync(fail("A rule with this name already exists"), "b");
  await assert.rejects(() => ensureLifecycleAsync(fail("Authentication error"), "b"), /Authentication/);
  let called;
  await ensureLifecycleAsync(async (a) => (called = a), "b");
  assert.deepEqual(called, lifecycleArgs("b"));
});

test("runWithRetryAsync: 一時的な認証エラーのときだけ待って再実行する", async () => {
  let n = 0;
  const result = await runWithRetryAsync(
    async () => {
      if (++n < 2) throw new Error("Authentication error [code: 10000]");
      return "ok";
    },
    { sleep: async () => {} }
  );
  assert.equal(result, "ok");
  assert.equal(n, 2);
  let m = 0;
  await assert.rejects(
    () =>
      runWithRetryAsync(
        async () => {
          m++;
          throw new Error("boom");
        },
        { sleep: async () => {} }
      ),
    /boom/
  );
  assert.equal(m, 1);
});

test("renderTimings: ステップ名と秒数、全体を出す", () => {
  const out = renderTimings(
    [
      ["deploy", 12345],
      ["seed", 800],
    ],
    13000
  );
  assert.match(out, /deploy\s*: 12\.3s/);
  assert.match(out, /seed\s*: 0\.8s/);
  assert.match(out, /全体\s*: 13\.0s/);
});
