#!/usr/bin/env node
/**
 * 開発環境の点検(`npm run doctor`)。足りないものと、その直し方を一覧で表示する。
 *
 * 新しい PC / 作り直したコンテナで、ツール(devcontainer が入れる)とログイン(機密情報なので手で行う)の
 * どこまで揃ったかを確かめるために使う。必須が欠けていれば終了コード 1。「任意」はデプロイする人だけ要る。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** `.nvmrc` の値("22" など)と実行中の Node のバージョン("v22.23.2")のメジャーが合うか。 */
export function nodeMatches(wanted, actual) {
  const major = (v) => String(v).trim().replace(/^v/, "").split(".")[0];
  return major(wanted) === major(actual);
}

/** 点検項目の定義。check(env) は真偽を返し、例外は失敗扱い。env は外部の確認を差し替えるための窓口。 */
export function buildChecks(env) {
  return [
    {
      name: `Node.js (.nvmrc = ${env.nvmrc})`,
      check: () => nodeMatches(env.nvmrc, env.nodeVersion),
      fix: "nvm install && nvm use(devcontainer なら Reopen in Container)",
    },
    { name: "依存パッケージ (node_modules)", check: () => env.exists("node_modules"), fix: "npm ci" },
    {
      name: "Playwright の chromium(e2e 用)",
      check: () => env.chromiumInstalled(),
      fix: "npx playwright install --with-deps chromium",
    },
    { name: "GitHub にログイン済み", check: () => env.succeeds("gh", ["auth", "status"]), fix: "gh auth login" },
    {
      name: "Cloudflare にログイン済み(デプロイ・staging)",
      optional: true,
      check: () => env.succeeds("npx", ["wrangler", "whoami"]),
      fix: "npx wrangler login --callback-host=0.0.0.0(または CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID)",
    },
    {
      name: "R2 の S3 キー(profile r2、バケットを空にする用)",
      optional: true,
      check: () => env.succeeds("aws", ["configure", "list", "--profile", "r2"]) && env.hasAwsProfile("r2"),
      fix: "docs/dev-environment.md の「R2 の S3 キー」を参照(aws configure --profile r2)",
    },
    {
      name: "clasp にログイン済み(GAS デプロイ)",
      optional: true,
      check: () => env.exists(join(env.home, ".clasprc.json")),
      fix: "npx clasp login --no-localhost",
    },
  ];
}

/** 項目を実行して結果の配列にする。 */
export function runChecks(checks) {
  return checks.map((c) => {
    let ok = false;
    try {
      ok = Boolean(c.check());
    } catch {
      ok = false;
    }
    return { name: c.name, optional: Boolean(c.optional), fix: c.fix, ok };
  });
}

/** 表示用の文面。必須の欠けが無ければ failed は false。 */
export function renderReport(results) {
  const lines = ["", "=== 開発環境の点検 ==="];
  for (const r of results) {
    const mark = r.ok ? "✔" : r.optional ? "-" : "✘";
    lines.push(`  ${mark} ${r.name}${r.ok || !r.optional ? "" : "(任意)"}`);
    if (!r.ok) lines.push(`      → ${r.fix}`);
  }
  const failed = results.some((r) => !r.ok && !r.optional);
  lines.push("", failed ? "必須の項目が足りません。上の → の手順を実行してください。" : "必須の項目は揃っています。", "");
  return { text: lines.join("\n"), failed };
}

function realEnv() {
  const home = process.env.HOME ?? "";
  const succeeds = (file, args) => {
    try {
      execFileSync(file, args, { stdio: "ignore", cwd: ROOT });
      return true;
    } catch {
      return false;
    }
  };
  return {
    home,
    nvmrc: readFileSync(join(ROOT, ".nvmrc"), "utf8").trim(),
    nodeVersion: process.version,
    exists: (p) => existsSync(p.startsWith("/") ? p : join(ROOT, p)),
    succeeds,
    chromiumInstalled: () => existsSync(join(home, ".cache", "ms-playwright")),
    hasAwsProfile: (profile) => {
      try {
        return readFileSync(join(home, ".aws", "credentials"), "utf8").includes(`[${profile}]`);
      } catch {
        return false;
      }
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { text, failed } = renderReport(runChecks(buildChecks(realEnv())));
  console.log(text);
  if (failed) process.exitCode = 1;
}
