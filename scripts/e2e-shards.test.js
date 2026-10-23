import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listSpecs, loadWeights, planShards } from "./e2e-shards.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("planShards: dedicated 以外のすべての spec が、ちょうど1つの束に入る(テストが抜けたり二重に流れたりしない)", () => {
  const weights = loadWeights();
  const specs = listSpecs();
  const dedicated = new Set(weights.dedicated);
  for (const target of ["ui", "gas"]) {
    for (const count of [1, 4, 5, 7]) {
      const all = planShards(specs, weights, target, count).flatMap((b) => b.specs);
      assert.deepEqual([...all].sort(), specs.filter((s) => !dedicated.has(s)));
    }
  }
});

test("planShards: 重い spec が1つの束に偏らない", () => {
  const specs = ["a.spec.ts", "b.spec.ts", "c.spec.ts", "d.spec.ts"];
  const weights = { default: 10, dedicated: [], ui: { "a.spec.ts": 100, "b.spec.ts": 50, "c.spec.ts": 50, "d.spec.ts": 10 } };
  const bins = planShards(specs, weights, "ui", 2);
  assert.deepEqual(bins.map((b) => b.total).sort((x, y) => x - y), [100, 110]);
});

test("shard-weights: dedicated と重みの名前は、実在する spec を指している", () => {
  const weights = loadWeights();
  const specs = new Set(listSpecs());
  for (const name of [...weights.dedicated, ...Object.keys(weights.ui), ...Object.keys(weights.gas)]) {
    assert.ok(specs.has(name), `${name} は e2e/ui にありません`);
  }
});

test("ci.yml: e2e の各マトリクス束数が、すべての spec を覆う(束数は planShards と同じ)", () => {
  const yml = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  for (const target of ["ui", "gas"]) {
    const counts = new Set([...yml.matchAll(new RegExp(`e2e-shards\\.js ${target} (\\d+)/(\\d+)`, "g"))].map((m) => m[2]));
    assert.equal(counts.size, 1, `${target} の束数がそろっていません`);
    const n = Number([...counts][0]);
    const indexes = [...yml.matchAll(new RegExp(`e2e-shards\\.js ${target} (\\d+)/`, "g"))].map((m) => Number(m[1])).sort();
    assert.deepEqual(indexes, Array.from({ length: n }, (_, i) => i + 1), `${target} の束 1〜${n} がすべてマトリクスにあること`);
  }
});
