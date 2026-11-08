import { test } from "node:test";
import assert from "node:assert/strict";
import { applyLifecyclePolicy, ensureLifecycle, ensureLifecycleAsync, isTransientAuthError, lifecycleArgs, lifecycleRemoveArgs, parseDeployUrl, parseSeedArgs, removeLegacyLifecycleAsync, renderTimings, renderUpSummary, resolveBootstrapPassword, runWithRetry, runWithRetryAsync } from "./cf-env.js";
import { ENVIRONMENTS } from "./lib/environments.js";

const { dev, staging, prod } = ENVIRONMENTS;

test("parseDeployUrl: デプロイ出力から workers.dev の URL を取り出す", () => {
  const out = "Uploaded octopus-scheduler-staging\nDeployed octopus-scheduler-staging triggers\n  https://octopus-scheduler-staging.example-sub.workers.dev\nCurrent Version ID: x";
  assert.equal(parseDeployUrl(out), "https://octopus-scheduler-staging.example-sub.workers.dev");
  assert.equal(parseDeployUrl("no url"), null);
});

test("renderUpSummary: Playwright を向けるコマンドと撤去の案内を含む", () => {
  const text = renderUpSummary({
    env: staging,
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
    env: staging,
    url: "https://x.workers.dev",
    seed: { admin: { id: "admin", password: "pw", sessionToken: "tok" }, participants: { ids: ["test-user-01"], password: "pu" } },
    session: { name: "S", code: "123456", reused: false },
  };
  assert.match(renderUpSummary(base), /結果データは投入していません/);
  assert.doesNotMatch(renderUpSummary(base), /サンプルの順位・当選履歴を投入済み/);
  assert.match(renderUpSummary({ ...base, withResults: true }), /サンプルの順位・当選履歴を投入済み/);
});

test("parseSeedArgs: 既定は結果を含まず、--with-results で含む。不明なフラグは拒否する", () => {
  assert.deepEqual(parseSeedArgs([]), { withResults: false, noSeed: false, positional: [] });
  assert.deepEqual(parseSeedArgs(["https://x.dev", "--with-results"]), { withResults: true, noSeed: false, positional: ["https://x.dev"] });
  assert.throws(() => parseSeedArgs(["--bogus"]), /不明な引数/);
});

test("lifecycleArgs: dev のバケットに1日で自動削除するルールを付ける", () => {
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

test("parseSeedArgs: prod は常に空なので --with-results / --no-seed を拒否する", () => {
  assert.throws(() => parseSeedArgs(["--with-results"], prod), /prod/);
  assert.throws(() => parseSeedArgs(["--no-seed"], prod), /prod/);
  assert.throws(() => parseSeedArgs(["--yes"], prod), /不明な引数/);
  assert.deepEqual(parseSeedArgs([], prod), { withResults: false, noSeed: false, positional: [] });
  assert.equal(parseSeedArgs(["--with-results"], dev).withResults, true);
});

test("renderUpSummary: 環境名が見出し・撤去/再投入の案内に出る。prod には撤去の案内を出さない", () => {
  const seed = { admin: { id: "admin", password: "pw", sessionToken: "tok" }, participants: { ids: ["test-user-01"], password: "pu" } };
  const session = { name: "S", code: "123456", reused: false };
  const text = renderUpSummary({ env: dev, url: "https://x.workers.dev", seed, session });
  assert.match(text, /=== dev 起動完了 ===/);
  assert.match(text, /npm run dev:down/);
  assert.match(text, /npm run dev:seed/);
  const blank = renderUpSummary({ env: prod, url: "https://x.workers.dev", blank: { adminId: "admin", generatedPassword: null } });
  assert.match(blank, /=== prod 起動完了\(テストデータなし\) ===/);
  assert.doesNotMatch(blank, /prod:down/);
});

test("resolveBootstrapPassword: 環境変数を優先し、required のときは無いと拒否する(ランダム生成しない)", () => {
  assert.deepEqual(resolveBootstrapPassword({ OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD: "longenough" }, () => "r"), { password: "longenough", generated: false });
  assert.deepEqual(resolveBootstrapPassword({}, () => "rand"), { password: "rand", generated: true });
  assert.throws(() => resolveBootstrapPassword({}, () => "rand", { required: true }), /OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD/);
  assert.throws(() => resolveBootstrapPassword({ OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD: "short" }, () => "r", { required: true }), /8文字/);
});

test("lifecycleRemoveArgs: 旧 staging-autoclean ルールを外す", () => {
  assert.deepEqual(lifecycleRemoveArgs("b"), ["r2", "bucket", "lifecycle", "remove", "b", "--name", "staging-autoclean"]);
});

test("removeLegacyLifecycleAsync: ルールが無い失敗は無視し、それ以外は例外にする", async () => {
  const fail = (message) => async () => {
    throw new Error(message);
  };
  await removeLegacyLifecycleAsync(fail("Rule not found"), "b");
  await assert.rejects(() => removeLegacyLifecycleAsync(fail("Authentication error"), "b"), /Authentication/);
});

test("applyLifecyclePolicy: dev は追加、staging は旧ルール削除、prod は何もしない", async () => {
  const run = async (env) => {
    const calls = [];
    const policy = await applyLifecyclePolicy(async (a) => calls.push(a), env);
    return { policy, calls };
  };
  assert.deepEqual(await run(dev), { policy: "add", calls: [lifecycleArgs(dev.bucket)] });
  assert.deepEqual(await run(staging), { policy: "remove", calls: [lifecycleRemoveArgs(staging.bucket)] });
  assert.deepEqual(await run(prod), { policy: "none", calls: [] });
});
