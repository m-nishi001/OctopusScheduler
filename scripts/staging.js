#!/usr/bin/env node
/**
 * Cloudflare 上の試験環境(staging)の作成と撤去。本番とは Worker・D1・R2 を完全に分ける。
 *
 *   npm run staging:up     D1/R2 作成 → wrangler.staging.toml 生成 → マイグレーション → デプロイ → 架空データ投入
 *   npm run staging:down   Worker / D1 / R2 を削除し、wrangler.staging.toml も消す
 *
 * 認証は wrangler の通常の方法(`wrangler login` または CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID)。
 * 本番と同じアカウントの無料枠を共有するため、普段は撤去しておき、実機確認のときだけ立てる。
 * 生成する wrangler.staging.toml(リソースIDを含む)と投入したパスワードはコミットしない(gitignore 済み)。
 * 事前に `npm run build` が必要。
 *
 * 注意: R2 バケットが空でないと削除できない(wrangler に一覧・一括削除が無い)。そのため staging:up でバケットに
 * 「1日で自動削除」のルールを付けてある。撤去時に空でなければ、翌日以降にもう一度 staging:down すればよい。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setup } from "./setup-cloudflare.js";
import { teardown } from "./teardown-cloudflare.js";
import { qrLoginUrl } from "./dev-stack.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOML_NAME = "wrangler.staging.toml";

export const STAGING = {
  workerName: "octopus-scheduler-staging",
  d1Name: "octopus-scheduler-staging-db",
  bucket: "octopus-scheduler-staging-assets",
};
/** 本番の namespace_id(1001/1002)とアカウント内で重ならないようにする。 */
const RATELIMIT_IDS = { "1001": "2001", "1002": "2002" };

/** テンプレートを staging 用に変える(Worker 名・レート制限の namespace_id)。 */
export function toStagingTemplate(template) {
  let out = template.replace(/^name\s*=\s*"[^"]+"/m, `name = "${STAGING.workerName}"`);
  for (const [from, to] of Object.entries(RATELIMIT_IDS)) {
    out = out.replace(`namespace_id = "${from}"`, `namespace_id = "${to}"`);
  }
  return out;
}

/** 本番のリソースを誤って触らないための確認(名前が本番の既定と同じなら例外)。 */
export function assertNotProduction({ workerName, d1Name, bucket }, production = { workerName: "octopus-scheduler", d1Name: "octopus-scheduler-db", bucket: "octopus-scheduler-assets" }) {
  for (const key of Object.keys(production)) {
    if ([workerName, d1Name, bucket].includes(production[key])) throw new Error(`staging の名前が本番(${production[key]})と同じです`);
  }
}

/** staging のバケットは使い捨てなので、オブジェクトを1日で自動削除する(空にしないと撤去できないため)。 */
export const LIFECYCLE_RULE = "staging-autoclean";

/** 自動削除ルールの追加コマンド引数。 */
export function lifecycleArgs(bucket) {
  return ["r2", "bucket", "lifecycle", "add", bucket, LIFECYCLE_RULE, "--expire-days", "1", "--force"];
}

/** ルールが既にあって追加に失敗したのは問題ない。それ以外の失敗は例外にする。 */
export function ensureLifecycle(run, bucket) {
  try {
    run(lifecycleArgs(bucket));
  } catch (error) {
    const text = `${error.stderr ?? ""}${error.stdout ?? ""}${error.message ?? ""}`;
    if (!/already exists|must be unique|duplicate/i.test(text)) throw error;
  }
}

/** `wrangler deploy` の出力から公開URLを取り出す。無ければ null。 */
export function parseDeployUrl(output) {
  const m = output.match(/https:\/\/[A-Za-z0-9.-]+\.workers\.dev/);
  return m ? m[0] : null;
}

/** up 完了時に表示する、テストを staging に向けるための案内。 */
export function renderUpSummary({ url, seed }) {
  return [
    "",
    "=== staging 起動完了 ===",
    `  URL        : ${url ?? "(デプロイ出力から取得できませんでした。ダッシュボードで確認してください)"}`,
    `  管理者     : ID ${seed.admin.id} / パスワード ${seed.admin.password}`,
    `  参加者     : ${seed.participants.ids[0]} 〜 ${seed.participants.ids.at(-1)} / 共通パスワード ${seed.participants.password}`,
    `  受付QR相当 : ${qrLoginUrl(url ?? "<URL>", seed.participants.ids[0], seed.participants.loginKeys?.[seed.participants.ids[0]])}`,
    "",
    "  Playwright を向ける:",
    `    BASE=${url ?? "<URL>"} E2E_ADMIN_ID=${seed.admin.id} E2E_ADMIN_PASSWORD=${seed.admin.password} E2E_ADMIN_TOKEN=${seed.admin.sessionToken} \\`,
    "      npx playwright test -c e2e/playwright.config.ts",
    "",
    "  使い終わったら npm run staging:down(無料枠は本番と共有)",
    "",
  ].join("\n");
}

const wranglerRun = (args, stdio = ["ignore", "pipe", "inherit"]) =>
  execFileSync("npx", ["-y", "wrangler@4", ...args], { cwd: ROOT, encoding: "utf8", stdio });

function up() {
  assertNotProduction(STAGING);
  if (!existsSync(join(ROOT, "dist/cloudflare/worker.js"))) {
    throw new Error("dist/cloudflare/worker.js がありません。先に npm run build を実行してください。");
  }
  const tomlPath = join(ROOT, TOML_NAME);
  const result = setup({
    run: wranglerRun,
    readTemplate: () => toStagingTemplate(readFileSync(join(ROOT, "wrangler.example.toml"), "utf8")),
    existingToml: existsSync(tomlPath) ? readFileSync(tomlPath, "utf8") : null,
    d1Name: STAGING.d1Name,
    bucket: STAGING.bucket,
  });
  if (result.toml !== null) {
    writeFileSync(tomlPath, result.toml);
    console.log(`${TOML_NAME} を生成しました。${result.created.length ? `作成: ${result.created.join(", ")}` : "既存リソースを使用"}`);
  }

  // 「既にルールがある」失敗を見分けるため、この呼び出しだけ標準エラーを取り込む
  ensureLifecycle((args) => wranglerRun(args, ["ignore", "pipe", "pipe"]), STAGING.bucket);
  wranglerRun(["d1", "migrations", "apply", "DB", "--remote", "--config", TOML_NAME]);
  const deployOut = wranglerRun(["deploy", "--config", TOML_NAME], ["ignore", "pipe", "pipe"]);
  const seed = JSON.parse(
    execFileSync("node", [join(ROOT, "scripts/seed-test-data.js"), "--config", TOML_NAME, "--remote"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    })
  );
  console.log(renderUpSummary({ url: parseDeployUrl(deployOut), seed }));
}

function down() {
  assertNotProduction(STAGING);
  const tomlPath = join(ROOT, TOML_NAME);
  const result = teardown({
    run: (args) => wranglerRun(args, ["ignore", "pipe", "pipe"]),
    ...STAGING,
    keepBucket: false,
    removeLocalToml: () => existsSync(tomlPath) && rmSync(tomlPath),
    log: console.log,
  });
  if (result.bucketNotEmpty) {
    console.log(
      `\nR2 バケットが空でないため削除できませんでした。オブジェクトは1日で自動削除されるので、翌日以降にもう一度 npm run staging:down を実行してください(削除済みのものはスキップされます)。すぐ消したい場合は、ダッシュボードの R2 → ${STAGING.bucket} → Settings → Empty Bucket で空にしてから実行してください。`
    );
  }
  if (result.failed.length > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  try {
    if (command === "up") up();
    else if (command === "down") down();
    else throw new Error("使い方: node scripts/staging.js <up|down>");
  } catch (e) {
    console.error(e.message);
    // 標準エラーを取り込んで実行したコマンドの失敗は、中身も見せる
    if (e.stderr) console.error(String(e.stderr));
    process.exit(1);
  }
}
