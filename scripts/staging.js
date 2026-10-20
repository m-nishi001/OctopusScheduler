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
 * 注意: R2 バケットが空でないと削除できない(wrangler に一覧・一括削除が無い)。そのため撤去時は、AWS CLI の
 * profile r2(S3 互換 API。docs/dev-environment.md)でバケットを空にしてから削除する。profile が無いときの保険として、
 * staging:up でバケットに「1日で自動削除」のルールを付けてある(翌日以降にもう一度 staging:down すればよい)。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setup } from "./setup-cloudflare.js";
import { teardown } from "./teardown-cloudflare.js";
import { qrLoginUrl } from "./dev-stack.js";
import { emptyBucket } from "./lib/r2-s3.js";
import { runWrangler, runWranglerAsync } from "./lib/wrangler.js";
import { ensurePortalSession, seedDemoResults } from "./seed-session.js";

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
    if (!isLifecycleRuleExists(error)) throw error;
  }
}

/** ensureLifecycle の非同期版(`run` が Promise を返す)。 */
export async function ensureLifecycleAsync(run, bucket) {
  try {
    await run(lifecycleArgs(bucket));
  } catch (error) {
    if (!isLifecycleRuleExists(error)) throw error;
  }
}

function isLifecycleRuleExists(error) {
  const text = `${error.stderr ?? ""}${error.stdout ?? ""}${error.message ?? ""}`;
  return /already exists|must be unique|duplicate/i.test(text);
}

/** `wrangler deploy` の出力から公開URLを取り出す。無ければ null。 */
export function parseDeployUrl(output) {
  const m = output.match(/https:\/\/[A-Za-z0-9.-]+\.workers\.dev/);
  return m ? m[0] : null;
}

/** up 完了時に表示する、テストを staging に向けるための案内。 */
export function renderUpSummary({ url, seed, session }) {
  return [
    "",
    "=== staging 起動完了 ===",
    `  URL        : ${url ?? "(デプロイ出力から取得できませんでした。ダッシュボードで確認してください)"}`,
    `  管理者     : ID ${seed.admin.id} / パスワード ${seed.admin.password}`,
    `  参加者     : ${seed.participants.ids[0]} 〜 ${seed.participants.ids.at(-1)} / 共通パスワード ${seed.participants.password}`,
    `  受付QR相当 : ${qrLoginUrl(url ?? "<URL>", seed.participants.ids[0], seed.participants.loginKeys?.[seed.participants.ids[0]])}`,
    ...(session
      ? [`  セッション : 「${session.name}」(コード ${session.code})を参加者ポータルに公開済み。${session.reused ? "既存を再利用" : "新規作成"}。寿命は12時間(切れたら npm run staging:seed)。結果タブにはサンプルの順位・当選履歴を投入済み`]
      : []),
    "",
    "  Playwright を向ける:",
    `    BASE=${url ?? "<URL>"} E2E_ADMIN_ID=${seed.admin.id} E2E_ADMIN_PASSWORD=${seed.admin.password} E2E_ADMIN_TOKEN=${seed.admin.sessionToken} \\`,
    "      npx playwright test -c e2e/playwright.config.ts",
    "",
    "  使い終わったら npm run staging:down(無料枠は本番と共有)",
    "",
  ].join("\n");
}

/** Cloudflare API が一時的に返す認証エラー（再実行すると通る）。 */
export function isTransientAuthError(text) {
  return /Authentication error \[code: 10000\]/.test(text);
}

/** 一時的な認証エラーのときだけ、少し待って再実行する(最大 attempts 回)。それ以外の失敗はそのまま投げる。 */
export function runWithRetry(exec, { attempts = 3, sleep = sleepSync } = {}) {
  for (let i = 1; ; i++) {
    try {
      return exec();
    } catch (error) {
      const text = `${error.stderr ?? ""}${error.stdout ?? ""}${error.message ?? ""}`;
      if (i >= attempts || !isTransientAuthError(text)) throw error;
      sleep(2000 * i);
    }
  }
}

/** runWithRetry の非同期版。 */
export async function runWithRetryAsync(exec, { attempts = 3, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  for (let i = 1; ; i++) {
    try {
      return await exec();
    } catch (error) {
      const text = `${error.stderr ?? ""}${error.stdout ?? ""}${error.message ?? ""}`;
      if (i >= attempts || !isTransientAuthError(text)) throw error;
      await sleep(2000 * i);
    }
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// 標準エラーも取り込む（一時的な認証エラーの判定と、失敗時の表示のため。失敗したときは main が中身を出す）
const wranglerRun = (args) =>
  runWithRetry(() => runWrangler(args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }));

const wranglerRunAsync = (args) => runWithRetryAsync(() => runWranglerAsync(args, { cwd: ROOT }));
const execFileAsync = promisify(execFile);

/** 各ステップの所要時間を測って表示する(`label` の処理を実行して結果を返す)。 */
async function timed(label, timings, fn) {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    timings.push([label, Date.now() - start]);
  }
}

export function renderTimings(timings, totalMs) {
  const lines = timings.map(([label, ms]) => `  ${label.padEnd(12)}: ${(ms / 1000).toFixed(1)}s`);
  return ["", "所要時間(並列実行のため合計は一致しません):", ...lines, `  ${"全体".padEnd(10)}: ${(totalMs / 1000).toFixed(1)}s`].join("\n");
}

async function up() {
  const startedAt = Date.now();
  const timings = [];
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

  // この4つは互いに依存しない(デプロイはマイグレーション済みでなくても行える、シードは R2 バケットだけあればよい)ので並列に流す
  const [, , deployOut, seedOut] = await Promise.all([
    timed("lifecycle", timings, () => ensureLifecycleAsync(wranglerRunAsync, STAGING.bucket)),
    timed("migrations", timings, () => wranglerRunAsync(["d1", "migrations", "apply", "DB", "--remote", "--config", TOML_NAME])),
    timed("deploy", timings, () => wranglerRunAsync(["deploy", "--config", TOML_NAME])),
    timed("seed", timings, async () => (await execFileAsync("node", [join(ROOT, "scripts/seed-test-data.js"), "--config", TOML_NAME, "--remote"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })).stdout),
  ]);
  const url = parseDeployUrl(deployOut);
  const seed = JSON.parse(seedOut);
  if (url) writeFileSync(urlFile(), url);
  const session = url ? await timed("session", timings, () => ensurePortalSession({ baseUrl: url, token: seed.admin.sessionToken })) : null;
  if (url && session) await timed("results", timings, () => seedDemoResults({ baseUrl: url, token: seed.admin.sessionToken, sessionId: session.id, participantIds: seed.participants.ids }));
  console.log(renderUpSummary({ url, seed, session }));
  console.log(renderTimings(timings, Date.now() - startedAt));
}

/** `up` で得た URL を覚えておく場所(`seed` で使う。gitignore 済みの .wrangler 配下)。 */
function urlFile() {
  mkdirSync(join(ROOT, ".wrangler"), { recursive: true });
  return join(ROOT, ".wrangler", "staging-url");
}

/** デプロイはせず、架空データの再投入とポータル公開セッションの作り直しだけ行う(セッション期限切れ・コンテンツ更新時)。 */
async function seedOnly(argUrl) {
  assertNotProduction(STAGING);
  const url = argUrl ?? (existsSync(urlFile()) ? readFileSync(urlFile(), "utf8").trim() : null);
  if (!url) throw new Error("staging の URL が分かりません。先に npm run staging:up するか、node scripts/staging.js seed <URL> と指定してください。");
  const seedOut = (await execFileAsync("node", [join(ROOT, "scripts/seed-test-data.js"), "--config", TOML_NAME, "--remote"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })).stdout;
  const seed = JSON.parse(seedOut);
  const session = await ensurePortalSession({ baseUrl: url, token: seed.admin.sessionToken });
  await seedDemoResults({ baseUrl: url, token: seed.admin.sessionToken, sessionId: session.id, participantIds: seed.participants.ids });
  console.log(renderUpSummary({ url, seed, session }));
}

function down() {
  assertNotProduction(STAGING);
  const tomlPath = join(ROOT, TOML_NAME);
  const result = teardown({
    run: wranglerRun,
    emptyBucket: (b) => emptyBucket(b),
    ...STAGING,
    keepBucket: false,
    removeLocalToml: () => {
      if (existsSync(tomlPath)) rmSync(tomlPath);
      rmSync(urlFile(), { force: true });
    },
    log: console.log,
  });
  if (result.bucketNotEmpty) {
    console.log(
      `\nR2 バケットが空でないため削除できませんでした。AWS CLI の profile r2 を設定すると自動で空にします(docs/dev-environment.md)。それまでは、オブジェクトが1日で自動削除されるので翌日以降にもう一度 npm run staging:down を実行するか、ダッシュボードの R2 → ${STAGING.bucket} → Settings → Empty Bucket で空にしてから実行してください(削除済みのものはスキップされます)。`
    );
  }
  if (result.failed.length > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  try {
    if (command === "up") await up();
    else if (command === "down") down();
    else if (command === "seed") await seedOnly(process.argv[3]);
    else throw new Error("使い方: node scripts/staging.js <up|down|seed [URL]>");
  } catch (e) {
    console.error(e.message);
    // 標準エラーを取り込んで実行したコマンドの失敗は、中身も見せる
    if (e.stderr) console.error(String(e.stderr));
    process.exit(1);
  }
}
