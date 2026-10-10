import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs, planTargets, readWorkerName, teardown } from "./teardown-cloudflare.js";

const base = { workerName: "w", d1Name: "db", bucket: "bk", keepBucket: false };

function harness(failures = {}) {
  const calls = [];
  const logs = [];
  let removed = false;
  const run = (args) => {
    calls.push(args.join(" "));
    const key = args[0] === "r2" ? "r2" : args[0];
    if (failures[key]) throw Object.assign(new Error("boom"), { stderr: failures[key] });
    return "";
  };
  const opts = { ...base, run, removeLocalToml: () => (removed = true), log: (m) => logs.push(m) };
  return { calls, logs, opts, wasRemoved: () => removed };
}

test("readWorkerName は先頭の name を返す", () => {
  assert.equal(readWorkerName('name = "octopus-scheduler"\nmain = "x"'), "octopus-scheduler");
  assert.throws(() => readWorkerName("main = 1"));
});

test("parseArgs はフラグを解釈する", () => {
  assert.deepEqual(parseArgs(["--yes", "--keep-bucket"]), { yes: true, keepBucket: true, dryRun: false });
  assert.equal(parseArgs(["--dry-run"]).dryRun, true);
});

test("planTargets は R2 を残す/消すで表示が変わる", () => {
  assert.match(planTargets(base)[2], /消える/);
  assert.match(planTargets({ ...base, keepBucket: true })[2], /残す/);
});

test("すべて成功したら Worker→D1→R2 の順に削除し、wrangler.toml も消す", () => {
  const h = harness();
  const result = teardown(h.opts);
  assert.deepEqual(h.calls, ["delete --name w --force", "d1 delete db --skip-confirmation", "r2 bucket delete bk"]);
  assert.deepEqual(result, { failed: [], bucketNotEmpty: false });
  assert.equal(h.wasRemoved(), true);
});

test("--keep-bucket では R2 を触らない", () => {
  const h = harness();
  teardown({ ...h.opts, keepBucket: true });
  assert.equal(
    h.calls.some((c) => c.startsWith("r2")),
    false
  );
});

test("既に存在しないリソースは成功扱いで続行する", () => {
  const h = harness({ delete: "Worker not found", d1: "database does not exist" });
  const result = teardown(h.opts);
  assert.deepEqual(result.failed, []);
  assert.equal(h.calls.length, 3);
});

test("R2 が空でなければ失敗として報告し、wrangler.toml は残す", () => {
  const h = harness({ r2: "The bucket you tried to delete is not empty" });
  const result = teardown(h.opts);
  assert.deepEqual(result, { failed: ["r2"], bucketNotEmpty: true });
  assert.equal(h.wasRemoved(), false);
});

test("1つ失敗しても残りの削除は試みる", () => {
  const h = harness({ delete: "network error" });
  const result = teardown(h.opts);
  assert.deepEqual(result.failed, ["worker"]);
  assert.equal(h.calls.length, 3);
});
