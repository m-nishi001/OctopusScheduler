import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertDistFresh, checkDistFresh, computeSourceFingerprint, readDistStamp, writeDistStamp } from "./lib/dist-stamp.js";

const fakeRun = (sha, diff) => (args) => (args[0] === "rev-parse" ? `${sha}\n` : diff);
const A = "a".repeat(40);
const B = "b".repeat(40);

test("指紋: diff が空なら diffHash も空、変更があれば内容で変わる", () => {
  assert.equal(computeSourceFingerprint({ run: fakeRun(A, "") }).diffHash, "");
  const d1 = computeSourceFingerprint({ run: fakeRun(A, "x") });
  const d2 = computeSourceFingerprint({ run: fakeRun(A, "y") });
  assert.equal(d1.sha, A);
  assert.notEqual(d1.diffHash, "");
  assert.notEqual(d1.diffHash, d2.diffHash);
});

test("fresh: 一致すれば null", () => {
  const fp = { sha: A, diffHash: "" };
  assert.equal(checkDistFresh({ stamp: { ...fp }, fingerprint: fp }), null);
});

test("sha 違いは古い sha と現在の sha を示し、手順を案内する", () => {
  const msg = checkDistFresh({ stamp: { sha: A, diffHash: "" }, fingerprint: { sha: B, diffHash: "" } });
  assert.match(msg, /aaaaaaaa/);
  assert.match(msg, /bbbbbbbb/);
  assert.match(msg, /npm ci/);
  assert.match(msg, /npm run build/);
});

test("同じ sha でも未コミット差分が違えば dirty として検知する", () => {
  const msg = checkDistFresh({ stamp: { sha: A, diffHash: "" }, fingerprint: { sha: A, diffHash: "h" } });
  assert.match(msg, /dirty/);
});

test("刻印なしはエラー", () => {
  assert.throws(() => assertDistFresh({ distDir: "/x", fingerprint: { sha: A, diffHash: "" }, readStamp: () => null }), /ビルド記録/);
});

test("刻印の書き込み→読み込みの往復と、壊れた刻印は null", () => {
  const dir = mkdtempSync(join(tmpdir(), "stamp-"));
  try {
    assert.equal(readDistStamp(dir), null);
    writeDistStamp(dir, { sha: A, diffHash: "h" });
    const stamp = readDistStamp(dir);
    assert.equal(stamp.sha, A);
    assert.equal(stamp.diffHash, "h");
    assertDistFresh({ distDir: dir, fingerprint: { sha: A, diffHash: "h" } });
    assert.throws(() => assertDistFresh({ distDir: dir, fingerprint: { sha: B, diffHash: "h" } }), /bbbbbbbb/);
    assert.equal(readDistStamp(dir, { read: () => "{oops" }), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
