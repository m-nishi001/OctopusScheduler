#!/usr/bin/env node
/**
 * Cloudflare 上の環境(dev / staging / prod)の作成・更新・撤去。環境ごとに Worker・D1・R2・Durable Object・レート制限が別。
 * 環境の定義は scripts/lib/environments.js(純粋なデータ表)。
 *
 *   npm run dev:up | staging:up    D1/R2 作成 → wrangler.<env>.toml 生成 → マイグレーション → デプロイ → 架空データ投入
 *   npm run dev:up:blank | staging:up:blank   テストデータを入れずにデプロイ(管理者はブートストラップ用の Worker Secret から作られる)
 *   npm run dev:seed | staging:seed           架空データとポータル公開セッションの再投入だけ
 *   npm run dev:down | staging:down           Worker / D1 / R2 を削除し、wrangler.<env>.toml も消す
 *   npm run prod:up                本番の作成と更新を兼ねる。常に空の状態(管理者だけ)。初期管理者のパスワードは
 *                                  環境変数 OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD で必ず渡す。リソースがあれば作り直さずマイグレーションとデプロイだけ
 *   npm run prod:down              標準入力で Worker 名を入力しないと止まる
 *
 * 認証は wrangler の通常の方法(`wrangler login` または CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID)。
 * 生成する wrangler.<env>.toml(リソースIDを含む)と投入したパスワードはコミットしない(gitignore 済み)。
 * 事前に `npm run build` が必要。dist が現在のソース(HEAD と未コミット差分)のビルドでなければ up は拒否する
 * (git pull では gitignore 済みの dist は作り直されないため。刻印は dist/cloudflare/build-info.json、scripts/lib/dist-stamp.js)。
 *
 * 注意: R2 バケットが空でないと削除できない(wrangler に一覧・一括削除が無い)。そのため撤去時は、AWS CLI の
 * profile r2(S3 互換 API。docs/markdown/dev/dev-environment.md)でバケットを空にしてから削除する。profile が無いときの保険として、
 * dev のバケットだけは「1日で自動削除」のルールを付けてある(翌日以降にもう一度 dev:down すればよい)。
 * staging と prod には自動削除を付けない(staging:up は残っている旧ルールを外す)。
 */
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { setup } from "./setup-cloudflare.js";
import { planTargets, teardown } from "./teardown-cloudflare.js";
import { qrLoginUrl } from "./dev-stack.js";
import { assertDistFresh, currentFingerprint } from "./lib/dist-stamp.js";
import { assertCommandAllowed, AUTOCLEAN_RULE, getEnvironment, isDownConfirmed, LEGACY_STAGING_RULE, lifecyclePolicy, requiresTypedConfirmation, resolveCustomDomain, toEnvTemplate } from "./lib/environments.js";
import { emptyBucket } from "./lib/r2-s3.js";
import { runWrangler, runWranglerAsync } from "./lib/wrangler.js";
import { ensurePortalSession, seedDemoResults } from "./seed-session.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** R2 バケットの自動削除ルール名。 */
export const LIFECYCLE_RULE = AUTOCLEAN_RULE;

/** 自動削除ルールの追加コマンド引数(dev だけ)。 */
export function lifecycleArgs(bucket) {
  return ["r2", "bucket", "lifecycle", "add", bucket, LIFECYCLE_RULE, "--expire-days", "1", "--force"];
}

/** 旧 staging の自動削除ルールの削除コマンド引数。 */
export function lifecycleRemoveArgs(bucket) {
  return ["r2", "bucket", "lifecycle", "remove", bucket, "--name", LEGACY_STAGING_RULE];
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

/** 旧ルールが無くて削除に失敗したのは問題ない。それ以外の失敗は例外にする。 */
export async function removeLegacyLifecycleAsync(run, bucket) {
  try {
    await run(lifecycleRemoveArgs(bucket));
  } catch (error) {
    if (!isLifecycleRuleMissing(error)) throw error;
  }
}

/** 環境の方針(lifecyclePolicy)に従って自動削除ルールを整える。none なら何もしない。 */
export async function applyLifecyclePolicy(run, env) {
  const policy = lifecyclePolicy(env);
  if (policy === "add") await ensureLifecycleAsync(run, env.bucket);
  else if (policy === "remove") await removeLegacyLifecycleAsync(run, env.bucket);
  return policy;
}

function errorText(error) {
  return `${error.stderr ?? ""}${error.stdout ?? ""}${error.message ?? ""}`;
}

function isLifecycleRuleExists(error) {
  return /already exists|must be unique|duplicate/i.test(errorText(error));
}

function isLifecycleRuleMissing(error) {
  return /not found|does not exist|doesn't exist|no such|no lifecycle|no rule|10064/i.test(errorText(error));
}

/** `wrangler deploy` の出力から公開URLを取り出す。無ければ null。 */
export function parseDeployUrl(output) {
  const m = output.match(/https:\/\/[A-Za-z0-9.-]+\.workers\.dev/);
  return m ? m[0] : null;
}

/** up 完了時に表示する、テストをその環境に向けるための案内。 */
export function renderUpSummary({ env, url, seed, session, withResults = false, blank = null }) {
  const down = env.name === "prod" ? "" : `使い終わったら npm run ${env.name}:down(無料枠は他の環境と共有)`;
  const urlText = url ?? "(デプロイ出力から取得できませんでした。ダッシュボードで確認してください)";
  if (blank) {
    return [
      "",
      `=== ${env.name} 起動完了(テストデータなし) ===`,
      `  URL        : ${urlText}`,
      `  管理者     : ID ${blank.adminId}(初回ログイン時にブートストラップ用 Secret から作られます)`,
      blank.generatedPassword
        ? `  パスワード : ${blank.generatedPassword}(今回ランダムに生成。再表示されないので控えてください)`
        : "  パスワード : 環境変数 OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD に指定した値",
      ...(down ? ["", `  ${down}`] : []),
      "",
    ].join("\n");
  }
  return [
    "",
    `=== ${env.name} 起動完了 ===`,
    `  URL        : ${urlText}`,
    `  管理者     : ID ${seed.admin.id} / パスワード ${seed.admin.password}`,
    `  参加者     : ${seed.participants.ids[0]} 〜 ${seed.participants.ids.at(-1)} / 共通パスワード ${seed.participants.password}`,
    `  受付QR相当 : ${qrLoginUrl(url ?? "<URL>", seed.participants.ids[0], seed.participants.loginKeys?.[seed.participants.ids[0]])}`,
    ...(session
      ? [`  セッション : 「${session.name}」(コード ${session.code})を参加者ポータルに公開済み。${session.reused ? "既存を再利用" : "新規作成"}。寿命は12時間(切れたら npm run ${env.name}:seed)。${withResults ? "結果タブにはサンプルの順位・当選履歴を投入済み" : `結果データは投入していません(必要なら --with-results / npm run ${env.name}:seed:results)`}`]
      : []),
    "",
    "  Playwright を向ける:",
    `    BASE=${url ?? "<URL>"} E2E_ADMIN_ID=${seed.admin.id} E2E_ADMIN_PASSWORD=${seed.admin.password} E2E_ADMIN_TOKEN=${seed.admin.sessionToken} \\`,
    "      npx playwright test -c e2e/playwright.config.ts",
    "",
    `  ${down}`,
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

/**
 * ブートストラップ管理者のパスワード(8文字以上)。環境変数に無ければランダムに生成する(required のときは必須)。ファイルには書かない。
 */
export function resolveBootstrapPassword(env = process.env, random = () => randomBytes(12).toString("hex"), { required = false } = {}) {
  const given = env.OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD;
  if (given) {
    if (given.length < 8) throw new Error("OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD は8文字以上にしてください");
    return { password: given, generated: false };
  }
  if (required) throw new Error("この環境では初期管理者のパスワードを環境変数 OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD で渡してください(ランダム生成はしません)");
  return { password: random(), generated: true };
}

/** `up` / `seed` / `down` の引数を解釈する。結果データは `--with-results` を付けたときだけ投入する(既定は含まない)。prod は常に空なので受け付けない。 */
export function parseSeedArgs(argv, env = null) {
  const out = { withResults: false, noSeed: false, positional: [] };
  for (const arg of argv) {
    if (arg === "--with-results") out.withResults = true;
    else if (arg === "--no-seed") out.noSeed = true;
    else if (arg.startsWith("--")) throw new Error(`不明な引数: ${arg}(--with-results / --no-seed)`);
    else out.positional.push(arg);
  }
  if (env && !env.seed && (out.withResults || out.noSeed)) {
    throw new Error(`${env.name} は常に空の状態で作ります(--with-results / --no-seed は指定できません)`);
  }
  return out;
}

/** 環境ごとの実行コンテキスト(設定ファイル・URL 保存先・wrangler 実行関数)。 */
function contextOf(env) {
  const tomlPath = join(ROOT, env.tomlName);
  // 標準エラーも取り込む(一時的な認証エラーの判定と、失敗時の表示のため。失敗したときは呼び出し側が中身を出す)
  const run = (args) => runWithRetry(() => runWrangler(args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }));
  const runAsync = (args) => runWithRetryAsync(() => runWranglerAsync(args, { cwd: ROOT }));
  return { tomlPath, run, runAsync };
}

/** `up` で得た URL を覚えておく場所(`seed` で使う。gitignore 済みの .wrangler 配下)。 */
function urlFile(env) {
  mkdirSync(join(ROOT, ".wrangler"), { recursive: true });
  return join(ROOT, ".wrangler", `${env.name}-url`);
}

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

/** Worker Secret を登録する(値は標準入力で渡すので履歴・ファイルに残らない)。 */
function putSecret(env, name, value) {
  runWithRetry(() => runWrangler(["secret", "put", name, "--config", env.tomlName], { cwd: ROOT, input: value, stdio: ["pipe", "pipe", "pipe"] }));
}

function seedTestData(env) {
  return execFileAsync("node", [join(ROOT, "scripts/seed-test-data.js"), "--config", env.tomlName, "--remote"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).then((r) => r.stdout);
}

async function up(env, { withResults, noSeed }) {
  if (noSeed && withResults) throw new Error("--no-seed と --with-results は同時に指定できません(テストデータを入れないため)");
  // prod は常に空(管理者だけ)。パスワードは必ず環境変数で渡す。
  const blankMode = noSeed || !env.seed;
  const bootstrap = blankMode ? resolveBootstrapPassword(process.env, undefined, { required: !env.seed }) : null;
  const startedAt = Date.now();
  const timings = [];
  assertDistFresh({ distDir: join(ROOT, "dist"), fingerprint: currentFingerprint(ROOT) });
  const ctx = contextOf(env);
  const result = setup({
    run: ctx.run,
    readTemplate: () => toEnvTemplate(readFileSync(join(ROOT, "wrangler.example.toml"), "utf8"), env, { domain: resolveCustomDomain(env) }),
    existingToml: existsSync(ctx.tomlPath) ? readFileSync(ctx.tomlPath, "utf8") : null,
    d1Name: env.d1Name,
    bucket: env.bucket,
  });
  if (result.toml !== null) {
    writeFileSync(ctx.tomlPath, result.toml);
    console.log(`${env.tomlName} を生成しました。${result.created.length ? `作成: ${result.created.join(", ")}` : "既存リソースを使用"}`);
  }

  // この4つは互いに依存しない(デプロイはマイグレーション済みでなくても行える、シードは R2 バケットだけあればよい)ので並列に流す
  const [, , deployOut, seedOut] = await Promise.all([
    timed("lifecycle", timings, () => applyLifecyclePolicy(ctx.runAsync, env)),
    timed("migrations", timings, () => ctx.runAsync(["d1", "migrations", "apply", "DB", "--remote", "--config", env.tomlName])),
    timed("deploy", timings, () => ctx.runAsync(["deploy", "--config", env.tomlName])),
    blankMode ? Promise.resolve(null) : timed("seed", timings, () => seedTestData(env)),
  ]);
  const url = parseDeployUrl(deployOut);
  if (url) writeFileSync(urlFile(env), url);
  if (blankMode) {
    // 最初のログインより前に管理者のパスワードを反映しておく。prod は既存の環境(管理者作成済み)を上書きしない。
    const adminId = process.env.OCTOPUS_BOOTSTRAP_ADMIN_ID?.trim() || "admin";
    if (env.seed || result.created.length > 0) {
      await timed("secret", timings, async () => {
        putSecret(env, "OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD", bootstrap.password);
        if (adminId !== "admin") putSecret(env, "OCTOPUS_BOOTSTRAP_ADMIN_ID", adminId);
      });
    } else {
      console.log("既存の環境を更新しました(管理者のパスワードは変更していません)。");
    }
    console.log(renderUpSummary({ env, url, blank: { adminId, generatedPassword: bootstrap.generated ? bootstrap.password : null } }));
    console.log(renderTimings(timings, Date.now() - startedAt));
    return;
  }
  const seed = JSON.parse(seedOut);
  const session = url ? await timed("session", timings, () => ensurePortalSession({ baseUrl: url, token: seed.admin.sessionToken })) : null;
  if (url && session && withResults) await timed("results", timings, () => seedDemoResults({ baseUrl: url, token: seed.admin.sessionToken, sessionId: session.id, participantIds: seed.participants.ids }));
  console.log(renderUpSummary({ env, url, seed, session, withResults }));
  console.log(renderTimings(timings, Date.now() - startedAt));
}

/** デプロイはせず、架空データの再投入とポータル公開セッションの作り直しだけ行う(セッション期限切れ・コンテンツ更新時)。 */
async function seedOnly(env, argUrl, { withResults }) {
  const file = urlFile(env);
  const url = argUrl ?? (existsSync(file) ? readFileSync(file, "utf8").trim() : null);
  if (!url) throw new Error(`${env.name} の URL が分かりません。先に npm run ${env.name}:up するか、node scripts/cf-env.js ${env.name} seed <URL> と指定してください。`);
  const seed = JSON.parse(await seedTestData(env));
  const session = await ensurePortalSession({ baseUrl: url, token: seed.admin.sessionToken });
  if (withResults) await seedDemoResults({ baseUrl: url, token: seed.admin.sessionToken, sessionId: session.id, participantIds: seed.participants.ids });
  console.log(renderUpSummary({ env, url, seed, session, withResults }));
}

/** 標準入力で Worker 名を入力させる(prod の削除)。 */
async function askTypedConfirmation(env) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(`続けるには Worker 名 "${env.workerName}" を入力してください: `);
  } finally {
    rl.close();
  }
}

async function down(env) {
  if (requiresTypedConfirmation(env)) {
    console.log(`次の ${env.name} リソースを削除します:`);
    for (const t of planTargets({ workerName: env.workerName, d1Name: env.d1Name, bucket: env.bucket, keepBucket: false })) console.log(`  - ${t}`);
    if (!isDownConfirmed(env, await askTypedConfirmation(env))) {
      console.log("中止しました。");
      process.exitCode = 1;
      return;
    }
  }
  const ctx = contextOf(env);
  const result = teardown({
    run: ctx.run,
    emptyBucket: (b) => emptyBucket(b),
    workerName: env.workerName,
    d1Name: env.d1Name,
    bucket: env.bucket,
    keepBucket: false,
    removeLocalToml: () => {
      if (existsSync(ctx.tomlPath)) rmSync(ctx.tomlPath);
      rmSync(urlFile(env), { force: true });
    },
    log: console.log,
  });
  if (result.bucketNotEmpty) {
    console.log(
      `\nR2 バケットが空でないため削除できませんでした。AWS CLI の profile r2 を設定すると自動で空にします(docs/markdown/dev/dev-environment.md)。それまでは、${env.autoclean ? "オブジェクトが1日で自動削除されるので翌日以降にもう一度 " : "ダッシュボードの R2 → " + env.bucket + " → Settings → Empty Bucket で空にしてから、もう一度 "}npm run ${env.name}:down を実行してください(削除済みのものはスキップされます)。`
    );
  }
  if (result.failed.length > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const env = getEnvironment(process.argv[2]);
    const command = process.argv[3];
    assertCommandAllowed(env, command);
    const rest = parseSeedArgs(process.argv.slice(4), env);
    if (command === "up") await up(env, rest);
    else if (command === "down") await down(env);
    else await seedOnly(env, rest.positional[0], rest);
  } catch (e) {
    console.error(e.message);
    // 標準エラーを取り込んで実行したコマンドの失敗は、中身も見せる
    if (e.stderr) console.error(String(e.stderr));
    process.exit(1);
  }
}
