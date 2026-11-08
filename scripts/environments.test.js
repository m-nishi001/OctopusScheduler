import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertCommandAllowed, ENVIRONMENTS, getEnvironment, isDownConfirmed, lifecyclePolicy, requiresTypedConfirmation, resolveCustomDomain, toEnvTemplate, validateEnvironments } from "./lib/environments.js";

const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../wrangler.example.toml"), "utf8");
const { dev, staging, prod } = ENVIRONMENTS;
const clone = () => structuredClone(ENVIRONMENTS);

test("表そのものが検証を通る", () => {
  assert.doesNotThrow(() => validateEnvironments(ENVIRONMENTS));
});

test("validateEnvironments: 名前・設定ファイル・レート制限 ID が環境どうしで重ならない", () => {
  for (const key of ["workerName", "d1Name", "bucket", "tomlName"]) {
    const t = clone();
    t.dev[key] = t.prod[key];
    assert.throws(() => validateEnvironments(t), new RegExp(key));
  }
  const t = clone();
  t.dev.ratelimitIds = ["1001", "3002"];
  assert.throws(() => validateEnvironments(t), /ratelimitIds/);
});

test("validateEnvironments: prod は投入・自動削除をせず、削除に確認が要る", () => {
  for (const [key, value, pattern] of [["seed", true, /テストデータ/], ["autoclean", true, /自動削除/], ["confirmDown", false, /確認/]]) {
    const t = clone();
    t.prod[key] = value;
    assert.throws(() => validateEnvironments(t), pattern);
  }
});

test("表の内容: 3環境の名前・ID・R2 自動削除(dev だけ)", () => {
  assert.deepEqual(Object.keys(ENVIRONMENTS), ["dev", "staging", "prod"]);
  assert.equal(dev.workerName, "octopus-scheduler-dev");
  assert.equal(staging.d1Name, "octopus-scheduler-staging-db");
  assert.equal(prod.bucket, "octopus-scheduler-assets");
  assert.deepEqual([dev, staging, prod].map((e) => e.ratelimitIds), [["3001", "3002"], ["2001", "2002"], ["1001", "1002"]]);
  assert.deepEqual([dev, staging, prod].map(lifecyclePolicy), ["add", "remove", "none"]);
});

test("getEnvironment: 未知の環境は拒否する", () => {
  assert.equal(getEnvironment("dev"), dev);
  assert.throws(() => getEnvironment("production"), /不明な環境/);
  assert.throws(() => getEnvironment("constructor"), /不明な環境/);
});

test("toEnvTemplate: Worker 名とレート制限 ID を環境ごとに変える", () => {
  for (const env of [dev, staging, prod]) {
    const out = toEnvTemplate(template, env);
    assert.ok(out.includes(`name = "${env.workerName}"`));
    for (const id of env.ratelimitIds) assert.ok(out.includes(`namespace_id = "${id}"`));
    assert.doesNotMatch(out, /routes/);
  }
  const devOut = toEnvTemplate(template, dev);
  assert.ok(!devOut.includes('namespace_id = "1001"') && !devOut.includes('namespace_id = "1002"'));
});

test("toEnvTemplate: プレースホルダと Durable Object の設定は残す", () => {
  const out = toEnvTemplate(template, staging);
  assert.match(out, /REPLACE_WITH_YOUR_D1_DATABASE_ID/);
  assert.match(out, /SESSION_ROOM/);
  assert.match(out, /new_sqlite_classes/);
});

test("toEnvTemplate: 独自ドメインがあるときだけ routes を name の直後(トップレベル)に出す", () => {
  const out = toEnvTemplate(template, dev, { domain: "dev.example.test" });
  assert.match(out, /^name = "octopus-scheduler-dev"\nroutes = \[\{ pattern = "dev\.example\.test", custom_domain = true \}\]$/m);
  assert.ok(out.indexOf("routes") < out.indexOf("[assets]"));
});

test("resolveCustomDomain: 環境変数があるときだけ返す", () => {
  assert.equal(resolveCustomDomain(dev, {}), null);
  assert.equal(resolveCustomDomain(dev, { OCTOPUS_DOMAIN_DEV: "  " }), null);
  assert.equal(resolveCustomDomain(dev, { OCTOPUS_DOMAIN_DEV: "dev.example.test" }), "dev.example.test");
  assert.equal(resolveCustomDomain(prod, { OCTOPUS_DOMAIN_DEV: "x" }), null);
});

test("assertCommandAllowed: prod はテストデータの投入(seed)を拒否する", () => {
  assert.throws(() => assertCommandAllowed(prod, "seed"), /投入できません/);
  for (const c of ["up", "down"]) assert.doesNotThrow(() => assertCommandAllowed(prod, c));
  for (const env of [dev, staging]) for (const c of ["up", "seed", "down"]) assert.doesNotThrow(() => assertCommandAllowed(env, c));
  assert.throws(() => assertCommandAllowed(dev, "teardown"), /使い方/);
});

test("prod の削除は Worker 名を入力しないと進まない。dev/staging は確認不要", () => {
  assert.ok(requiresTypedConfirmation(prod));
  assert.ok(!requiresTypedConfirmation(dev) && !requiresTypedConfirmation(staging));
  assert.ok(!isDownConfirmed(prod, ""));
  assert.ok(!isDownConfirmed(prod, undefined));
  assert.ok(!isDownConfirmed(prod, "octopus-scheduler-dev"));
  assert.ok(!isDownConfirmed(prod, "yes"));
  assert.ok(isDownConfirmed(prod, " octopus-scheduler \n"));
  assert.ok(isDownConfirmed(dev, ""));
});
