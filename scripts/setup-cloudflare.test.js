import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findD1Id,
  hasPlaceholders,
  r2BucketExists,
  renderWranglerToml,
  setup,
} from "./setup-cloudflare.js";

const TEMPLATE = `[[d1_databases]]
binding = "DB"
database_name = "octopus-scheduler-db"
database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "REPLACE_WITH_YOUR_R2_BUCKET_NAME"
`;

/** wrangler の呼び出しを記録するフェイク。d1/r2 の既存状態を引数で指定する。 */
function fakeWrangler({ d1 = [], r2 = [] }) {
  const calls = [];
  const run = (args) => {
    calls.push(args.join(" "));
    if (args[0] === "d1" && args[1] === "list") return JSON.stringify(d1);
    if (args[0] === "d1" && args[1] === "create") {
      d1.push({ name: args[2], uuid: "new-uuid" });
      return "";
    }
    if (args[0] === "r2" && args[2] === "list") {
      return JSON.stringify(r2.map((n) => ({ name: n, creation_date: "2026-01-01" })));
    }
    if (args[0] === "r2" && args[2] === "create") {
      r2.push(args[3]);
      return "";
    }
    throw new Error(`unexpected: ${args.join(" ")}`);
  };
  return { run, calls };
}

const base = { readTemplate: () => TEMPLATE, d1Name: "db1", bucket: "bk1" };

test("creates D1 and R2 when they do not exist, then renders wrangler.toml", () => {
  const w = fakeWrangler({});
  const result = setup({ ...base, run: w.run, existingToml: null });

  assert.deepEqual(result.created, ["D1:db1", "R2:bk1"]);
  assert.match(result.toml, /database_id = "new-uuid"/);
  assert.match(result.toml, /database_name = "db1"/);
  assert.match(result.toml, /bucket_name = "bk1"/);
  assert.equal(hasPlaceholders(result.toml), false);
});

test("reuses existing resources without creating anything", () => {
  const w = fakeWrangler({ d1: [{ name: "db1", uuid: "u-1" }], r2: ["bk1"] });
  const result = setup({ ...base, run: w.run, existingToml: TEMPLATE });

  assert.deepEqual(result.created, []);
  assert.match(result.toml, /database_id = "u-1"/);
  assert.ok(!w.calls.some((c) => c.includes("create")));
});

test("skips everything when wrangler.toml is already filled in", () => {
  const w = fakeWrangler({});
  const result = setup({ ...base, run: w.run, existingToml: 'database_id = "abc"' });

  assert.equal(result.toml, null);
  assert.deepEqual(w.calls, []);
});

test("helpers", () => {
  assert.equal(findD1Id('[{"name":"a","uuid":"1"}]', "b"), null);
  assert.equal(r2BucketExists("name:   x\nname:   y", "y"), true);
  assert.equal(r2BucketExists("name:   xy", "y"), false);
  assert.equal(r2BucketExists('[{"name":"x"},{"name":"y"}]', "y"), true);
  assert.equal(r2BucketExists('[{"name":"xy"}]', "y"), false);
  assert.equal(r2BucketExists("[]", "y"), false);
  assert.match(renderWranglerToml(TEMPLATE, { d1Name: "n", d1Id: "i", bucket: "b" }), /"i"/);
});
