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

test("D1 が「Couldn't find a D1 DB」でも既に無いものとして扱う", () => {
  const h = harness({ d1: "Couldn't find a D1 DB with name or binding 'db'" });
  assert.deepEqual(teardown(h.opts).failed, []);
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

/** r2 bucket delete が1回目は「空でない」で失敗し、空にした後は成功する run。 */
function emptyThenDelete({ emptyFails = false } = {}) {
  const h = harness();
  const emptied = [];
  let deleteTries = 0;
  const run = (args) => {
    h.calls.push(args.join(" "));
    if (args[0] === "r2" && ++deleteTries === 1) throw Object.assign(new Error("boom"), { stderr: "The bucket you tried to delete is not empty" });
    return "";
  };
  const emptyBucket = (b) => {
    emptied.push(b);
    if (emptyFails) throw new Error("aws コマンドが見つかりません");
  };
  return { h, emptied, opts: { ...h.opts, run, emptyBucket } };
}

test("R2 が空でなくても、emptyBucket で空にして削除し直せば成功し、wrangler.toml も消す", () => {
  const { h, emptied, opts } = emptyThenDelete();
  const result = teardown(opts);
  assert.deepEqual(emptied, ["bk"]);
  assert.deepEqual(result, { failed: [], bucketNotEmpty: false });
  assert.equal(h.calls.filter((c) => c === "r2 bucket delete bk").length, 2);
  assert.equal(h.wasRemoved(), true);
});

test("空にするのに失敗したら、従来どおり bucketNotEmpty として報告する", () => {
  const { h, opts } = emptyThenDelete({ emptyFails: true });
  const result = teardown(opts);
  assert.deepEqual(result, { failed: ["r2"], bucketNotEmpty: true });
  assert.equal(h.wasRemoved(), false);
});

test("「空でない」以外の失敗では、バケットの中身を消さない", () => {
  const h = harness({ r2: "network error" });
  const emptied = [];
  teardown({ ...h.opts, emptyBucket: (b) => emptied.push(b) });
  assert.deepEqual(emptied, []);
});

test("--keep-bucket では emptyBucket も呼ばない", () => {
  const { emptied, opts } = emptyThenDelete();
  teardown({ ...opts, keepBucket: true });
  assert.deepEqual(emptied, []);
});
