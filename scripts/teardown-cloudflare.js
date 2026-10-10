#!/usr/bin/env node
/**
 * Cloudflare に作ったリソースの削除(`npm run teardown:cloudflare`)。`setup-cloudflare.js` の逆。
 *
 *   1. Worker を削除する(Durable Object・Worker の secret も一緒に消える)
 *   2. D1 データベースを削除する
 *   3. R2 バケットを削除する(バケットが空でないと失敗する。その場合は手順を表示する)
 *   4. ローカルの wrangler.toml を削除する(次回デプロイで新しい ID で生成し直す)
 *
 * 管理者アカウントやセッションは R2 に入っているため、バケットを消すと失われる。
 * 消さずに残したいときは `--keep-bucket`。確認なしで実行するときは `--yes`。
 * 何も消さずに対象を表示するだけなら `--dry-run`。
 * 認証・リソース名は setup-cloudflare.js と同じ(`wrangler login` / CLOUDFLARE_* 環境変数)。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_D1_NAME = "octopus-scheduler-db";
const DEFAULT_R2_BUCKET = "octopus-scheduler-assets";

/** wrangler.example.toml の先頭にある `name = "..."`(Worker 名)を返す。 */
export function readWorkerName(toml) {
  const m = toml.match(/^name\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error("wrangler.example.toml から Worker 名を読み取れませんでした。");
  return m[1];
}

export function parseArgs(argv) {
  return {
    yes: argv.includes("--yes"),
    keepBucket: argv.includes("--keep-bucket"),
    dryRun: argv.includes("--dry-run"),
  };
}

/** 削除する対象の一覧(確認表示とテストに使う)。 */
export function planTargets({ workerName, d1Name, bucket, keepBucket }) {
  const targets = [`Worker: ${workerName}(Durable Object と secret を含む)`, `D1: ${d1Name}`];
  targets.push(keepBucket ? `R2: ${bucket}(残す)` : `R2: ${bucket}(管理者アカウント・セッションも消える)`);
  return targets;
}

/** 失敗を握りつぶさず、結果の文言にして続行する(存在しないリソースは「なし」扱い)。 */
function attempt(label, fn, log) {
  try {
    fn();
    log(`✔ ${label}`);
    return { ok: true };
  } catch (error) {
    const text = `${error.stderr ?? ""}${error.stdout ?? ""}${error.message ?? ""}`;
    if (/not found|does not exist|no such|10007|10006|7404/i.test(text)) {
      log(`- ${label}(既に存在しません)`);
      return { ok: true, missing: true };
    }
    log(`✘ ${label}: ${text.split("\n").find((l) => l.trim()) ?? "失敗"}`);
    return { ok: false, text };
  }
}

/**
 * 削除の本体。run(args) は wrangler を実行する関数(テストで差し替える)。
 * 戻り値: { failed: string[], bucketNotEmpty: boolean }
 */
export function teardown({ run, workerName, d1Name, bucket, keepBucket, removeLocalToml, log }) {
  const failed = [];
  let bucketNotEmpty = false;

  if (!attempt("Worker を削除", () => run(["delete", "--name", workerName, "--force"]), log).ok) failed.push("worker");
  if (!attempt("D1 を削除", () => run(["d1", "delete", d1Name, "--skip-confirmation"]), log).ok) failed.push("d1");

  if (!keepBucket) {
    const r = attempt("R2 バケットを削除", () => run(["r2", "bucket", "delete", bucket]), log);
    if (!r.ok) {
      failed.push("r2");
      bucketNotEmpty = /not empty|non-empty|10008|must be empty/i.test(r.text ?? "");
    }
  }

  if (failed.length === 0) removeLocalToml();
  return { failed, bucketNotEmpty };
}

async function confirm(workerName) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`続けるには Worker 名 "${workerName}" を入力してください: `);
    return answer.trim() === workerName;
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workerName = readWorkerName(readFileSync(join(ROOT, "wrangler.example.toml"), "utf8"));
  const d1Name = process.env.CLOUDFLARE_D1_NAME || DEFAULT_D1_NAME;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET || DEFAULT_R2_BUCKET;

  console.log("次の Cloudflare リソースを削除します:");
  for (const t of planTargets({ workerName, d1Name, bucket, keepBucket: args.keepBucket })) console.log(`  - ${t}`);
  if (args.dryRun) {
    console.log("(--dry-run のため何も削除しませんでした)");
    return;
  }
  if (!args.yes && !(await confirm(workerName))) {
    console.log("中止しました。");
    process.exitCode = 1;
    return;
  }

  const tomlPath = join(ROOT, "wrangler.toml");
  const run = (a) =>
    execFileSync("npx", ["wrangler", ...a], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const result = teardown({
    run,
    workerName,
    d1Name,
    bucket,
    keepBucket: args.keepBucket,
    removeLocalToml: () => existsSync(tomlPath) && rmSync(tomlPath),
    log: console.log,
  });

  if (result.bucketNotEmpty) {
    console.log(
      `\nR2 バケットが空でないため削除できませんでした。ダッシュボードの R2 → ${bucket} → Settings → Empty Bucket で空にしてから、もう一度 npm run teardown:cloudflare を実行してください(削除済みのものはスキップされます)。`
    );
  }
  if (result.failed.length > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
