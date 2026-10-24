import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_TARGETS, freePort, parseArgs, renderLocalToml, simulatedLatencyVars, TARGETS } from "./e2e-local.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("renderLocalToml: プレースホルダを残さず、パスを絶対パスにし、DOのバインディングを保つ", () => {
  const toml = renderLocalToml(readFileSync(join(ROOT, "wrangler.example.toml"), "utf8"));
  // コメント中の説明文(REPLACE_WITH_*)ではなく、値としてのプレースホルダが残っていないこと
  assert.doesNotMatch(toml, /=\s*"REPLACE_WITH_/);
  assert.match(toml, /^main = "\/.*dist\/cloudflare\/worker\.js"$/m);
  assert.match(toml, /^directory = "\/.*dist\/cloudflare\/assets"$/m);
  assert.match(toml, /^migrations_dir = "\/.*packages\/infrastructures\/migrations"$/m);
  assert.match(toml, /database_id = "00000000-0000-0000-0000-000000000000"/);
  assert.match(toml, /name = "SESSION_ROOM"/);
  assert.match(toml, /new_sqlite_classes = \["SessionRoom"\]/);
});

test("renderLocalToml: 実在のリソースIDや認証情報を含まない(公開リポジトリ)", () => {
  const toml = renderLocalToml(readFileSync(join(ROOT, "wrangler.example.toml"), "utf8"));
  assert.doesNotMatch(toml, /account_id|api_token/i);
});

test("simulatedLatencyVars: 未設定なら何も足さず、設定したぶんだけ [vars] にする。不正な値はエラー", () => {
  assert.equal(simulatedLatencyVars({}), "");
  assert.equal(simulatedLatencyVars({ SIM_R2_LATENCY_MS: "" }), "");
  assert.equal(simulatedLatencyVars({ SIM_R2_LATENCY_MS: "80" }), '\n[vars]\nSIM_R2_LATENCY_MS = "80"\n');
  assert.match(simulatedLatencyVars({ SIM_R2_LATENCY_MS: "80", SIM_D1_LATENCY_MS: "40" }), /SIM_D1_LATENCY_MS = "40"/);
  assert.throws(() => simulatedLatencyVars({ SIM_R2_LATENCY_MS: "abc" }), /SIM_R2_LATENCY_MS/);
  assert.throws(() => simulatedLatencyVars({ SIM_D1_LATENCY_MS: "0" }), /SIM_D1_LATENCY_MS/);
});

test("simulatedLatencyVars: SIM_LATENCY=staging は 80/30ms。個別指定が優先され、未知の名前はエラー", () => {
  const vars = simulatedLatencyVars({ SIM_LATENCY: "staging" });
  assert.match(vars, /SIM_R2_LATENCY_MS = "80"/);
  assert.match(vars, /SIM_D1_LATENCY_MS = "30"/);
  assert.match(simulatedLatencyVars({ SIM_LATENCY: "staging", SIM_R2_LATENCY_MS: "120" }), /SIM_R2_LATENCY_MS = "120"/);
  assert.throws(() => simulatedLatencyVars({ SIM_LATENCY: "nope" }), /SIM_LATENCY/);
});

test("freePort:使用可能なポート番号を返す", async () => {
  const port = await freePort();
  assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
});

test("parseArgs: 引数なしでは負荷テストを動かさない。名前を指定したときだけ動く", () => {
  assert.deepEqual(parseArgs([]).targets, DEFAULT_TARGETS);
  assert.ok(!DEFAULT_TARGETS.includes("load") && !DEFAULT_TARGETS.includes("load-ui"));
  assert.ok("load" in TARGETS && "load-ui" in TARGETS);
  assert.deepEqual(parseArgs(["load"]).targets, ["load"]);
  assert.deepEqual(parseArgs(["load-ui", "--", "--headed"]), { targets: ["load-ui"], extra: ["--headed"], platform: "cloudflare" });
  assert.throws(() => parseArgs(["nothing"]), /不明なテスト/);
});

test("parseArgs: --target gas は ui だけを GAS シミュレーターで流す。Cloudflare 専用のテストは指定できない", () => {
  assert.deepEqual(parseArgs(["--target", "gas"]), { targets: ["ui"], extra: [], platform: "gas" });
  assert.deepEqual(parseArgs(["ui", "--target=gas", "--", "--shard=1/8"]), { targets: ["ui"], extra: ["--shard=1/8"], platform: "gas" });
  assert.throws(() => parseArgs(["worker-smoke", "--target", "gas"]), /Cloudflare 専用/);
  assert.throws(() => parseArgs(["--target", "nope"]), /不明な --target/);
});
