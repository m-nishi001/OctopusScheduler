#!/usr/bin/env node
/**
 * 開発中の通しの動作確認用に、ローカルの実 workerd(`wrangler dev --local`)をテストデータ付きで1コマンドで起動する。
 *
 *   1. wrangler.example.toml からローカル専用の設定を作る(ダミーのD1 ID。リモートには一切触れない)
 *   2. ローカルD1にマイグレーションを適用し、架空のテストデータ(管理者 + 参加者メンバー)を投入する
 *   3. wrangler dev を前面で起動し、URL とログイン情報を表示する。Ctrl-C で停止する
 *
 * 状態は worktree ごとの `.wrangler/dev-stack/`(gitignore 済み)に残るので、再起動してもデータが続く。
 * 作り直したいときは `--reset`。事前に `npm run build` が必要(dist/cloudflare/worker.js を使う)。
 *
 * 使い方: node scripts/dev-stack.js [--port 8800] [--count 20] [--reset]
 * 他のセッションの wrangler と衝突しないよう、既定ポートは空きポートから選ぶ。
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { freePort, renderLocalToml, waitForReady, wrangler } from "./e2e-local.js";
import { wranglerCommand } from "./lib/wrangler.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** コマンドライン引数を解釈する。 */
export function parseArgs(argv) {
  const out = { reset: false, port: undefined, count: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--reset") out.reset = true;
    else if (arg === "--port" || arg === "--count") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error(`${arg} には正の整数を指定してください`);
      out[arg.slice(2)] = value;
    } else throw new Error(`不明な引数: ${arg}(--port / --count / --reset)`);
  }
  return out;
}

/** 状態・設定の置き場所(worktree ごと)。 */
export function stackPaths(root) {
  const dir = join(root, ".wrangler", "dev-stack");
  return { dir, config: join(dir, "wrangler.toml"), state: join(dir, "state") };
}

/** 受付QRが開くログインURL(キーはフラグメントに入れる。サーバーには送られない)。 */
export function qrLoginUrl(base, id, key) {
  return key ? `${base}/#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}` : "(キーなし)";
}

/** 全参加者の「受付QR相当」ログインURLの一覧（複数のブラウザで試すときに使う）。 */
export function participantLoginUrls(base, seed) {
  return seed.participants.ids.map((id) => ({ id, url: qrLoginUrl(base, id, seed.participants.loginKeys?.[id]) }));
}

/** 画面で見せる案内文。 */
export function renderBanner({ base, seed, urlsFile }) {
  const ids = seed.participants.ids;
  return [
    "",
    "=== dev:stack 起動完了 ===",
    `  アプリ        : ${base}/`,
    `  管理者        : ID ${seed.admin.id} / パスワード ${seed.admin.password}`,
    `  参加者        : ${ids[0]} 〜 ${ids.at(-1)}(${ids.length}名) / 共通パスワード ${seed.participants.password}`,
    `  受付QR相当    : ${qrLoginUrl(base, ids[0], seed.participants.loginKeys?.[ids[0]])}`,
    ...(urlsFile ? [`  全員の受付QR相当URL : ${urlsFile}`] : []),
    `  管理者トークン : ${seed.admin.sessionToken}(localStorage の octopus-session-token に入れるとログイン済みになる)`,
    "",
    "  Ctrl-C で停止。手順は docs/dev-verification.md",
    "",
  ].join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!existsSync(join(ROOT, "dist/cloudflare/worker.js"))) {
    throw new Error("dist/cloudflare/worker.js がありません。先に npm run build を実行してください。");
  }
  const paths = stackPaths(ROOT);
  if (args.reset) rmSync(paths.dir, { recursive: true, force: true });
  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.config, renderLocalToml(readFileSync(join(ROOT, "wrangler.example.toml"), "utf8")));

  wrangler(["d1", "migrations", "apply", "DB", "--local", "--config", paths.config, "--persist-to", paths.state]);
  const seedArgs = [join(ROOT, "scripts/seed-test-data.js"), "--config", paths.config, "--persist-to", paths.state];
  if (args.count) seedArgs.push("--count", String(args.count));
  const seed = JSON.parse(execFileSync("node", seedArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));

  const port = args.port ?? (await freePort());
  const inspectorPort = await freePort();
  const [wranglerFile, wranglerPrefix] = wranglerCommand();
  const child = spawn(
    wranglerFile,
    [...wranglerPrefix, "dev", "--local", "--config", paths.config, "--persist-to", paths.state, "--port", String(port), "--inspector-port", String(inspectorPort)],
    { stdio: ["ignore", "pipe", "pipe"], detached: true }
  );
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const stop = () => {
    if (child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
  };
  process.on("SIGINT", () => {
    stop();
    process.exit(0);
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    await waitForReady(base, child);
  } catch (e) {
    console.error(log.split("\n").slice(-30).join("\n"));
    stop();
    throw e;
  }
  // 全員分のログインURL（キーを含むので gitignore 済みの .wrangler 配下に書く）
  const urlsFile = join(paths.dir, "participants.json");
  writeFileSync(urlsFile, JSON.stringify(participantLoginUrls(base, seed), null, 2));
  console.log(renderBanner({ base, seed, urlsFile }));
  await new Promise((done) => child.on("exit", done));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
