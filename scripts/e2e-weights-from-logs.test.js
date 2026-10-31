import { test } from "node:test";
import assert from "node:assert/strict";
import { averageWeights, mergeWeights, parseJobLog } from "./e2e-weights-from-logs.js";

const LOG = [
  "2026-10-31T01:00:00.0000000Z > node scripts/e2e-local.js --target gas ui -- e2e/ui/a.spec.ts",
  "2026-10-31T01:00:10.0000000Z Running 4 tests using 1 worker",
  "2026-10-31T01:00:20.0000000Z   ✓   1 e2e/ui/a.spec.ts:5:3 › x (10.0s)",
  "2026-10-31T01:00:50.0000000Z   ✓   2 e2e/ui/a.spec.ts:9:3 › y (30.0s)",
  "2026-10-31T01:01:00.0000000Z   ✓   3 e2e/ui/b.spec.ts:5:3 › z (10.0s)",
  "2026-10-31T01:01:00.0000000Z   -   4 e2e/ui/b.spec.ts:9:3 › skipped",
].join("\n");

test("parseJobLog: 結果行の時刻の差を spec ごとに合計し、--target gas を判別する", () => {
  const { target, seconds } = parseJobLog(LOG);
  assert.equal(target, "gas");
  assert.deepEqual(seconds, { "a.spec.ts": 40, "b.spec.ts": 10 });
});

test("averageWeights / mergeWeights: 平均して重い順に並べ、測れなかった spec と dedicated は残す", () => {
  const measured = averageWeights([
    { target: "ui", seconds: { "a.spec.ts": 10 } },
    { target: "ui", seconds: { "a.spec.ts": 20, "d.spec.ts": 99 } },
  ]);
  assert.deepEqual(measured.ui, { "a.spec.ts": 15, "d.spec.ts": 99 });
  const merged = mergeWeights(
    { default: 30, dedicated: ["d.spec.ts"], ui: { "a.spec.ts": 1, "c.spec.ts": 50, "d.spec.ts": 7 }, gas: {} },
    measured,
  );
  assert.deepEqual(Object.entries(merged.ui), [["c.spec.ts", 50], ["a.spec.ts", 15], ["d.spec.ts", 7]]);
});
