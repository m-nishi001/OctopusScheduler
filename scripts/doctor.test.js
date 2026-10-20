import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChecks, nodeMatches, renderReport, runChecks } from "./doctor.js";

const okEnv = {
  home: "/root",
  nvmrc: "22",
  nodeVersion: "v22.23.2",
  exists: () => true,
  succeeds: () => true,
  chromiumInstalled: () => true,
  hasAwsProfile: () => true,
};

test("nodeMatches: メジャーバージョンで比べる", () => {
  assert.equal(nodeMatches("22", "v22.23.2"), true);
  assert.equal(nodeMatches("v22", "22.1.0"), true);
  assert.equal(nodeMatches("22", "v20.1.0"), false);
});

test("すべて揃っていれば failed にならない", () => {
  const { text, failed } = renderReport(runChecks(buildChecks(okEnv)));
  assert.equal(failed, false);
  assert.doesNotMatch(text, /✘/);
});

test("必須が欠けると failed になり、直し方を表示する", () => {
  const { text, failed } = renderReport(runChecks(buildChecks({ ...okEnv, exists: () => false })));
  assert.equal(failed, true);
  assert.match(text, /✘ 依存パッケージ/);
  assert.match(text, /→ npm ci/);
});

test("任意の項目だけ欠けても failed にならない", () => {
  const env = { ...okEnv, succeeds: (file) => file === "gh" || file === "npx", hasAwsProfile: () => false };
  const { text, failed } = renderReport(runChecks(buildChecks(env)));
  assert.equal(failed, false);
  assert.match(text, /- R2 の S3 キー.*(任意)/);
});

test("確認が例外を投げても失敗扱いで続行する", () => {
  const env = {
    ...okEnv,
    succeeds: () => {
      throw new Error("boom");
    },
  };
  const results = runChecks(buildChecks(env));
  assert.equal(results.length, buildChecks(okEnv).length);
  assert.equal(results.find((r) => r.name.startsWith("GitHub")).ok, false);
});
