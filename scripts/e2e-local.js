#!/usr/bin/env node
/**
 * ローカルの実 workerd(`wrangler dev --local`)に対する E2E 実行ランナー。
 *
 *   1. wrangler.example.toml から**ローカル専用**の設定を一時ディレクトリに生成する
 *      (ダミーのD1 ID。リモートのリソースには一切触れない。リポジトリにも置かない)
 *   2. ローカルD1にマイグレーションを適用し、管理者アカウントとログイン済みセッションを投入する
 *   3. wrangler dev を起動して準備できるまで待ち、テストコマンドを実行し、終了時に必ず停止する
 *
 * 使い方: node scripts/e2e-local.js [テストファイル ...]   (既定: e2e/worker-smoke.mjs)
 * 事前に `npm run build` が必要(dist/cloudflare/worker.js を使う)。
 * テストには環境変数 BASE / E2E_ADMIN_TOKEN / E2E_ADMIN_ID / E2E_ADMIN_PASSWORD が渡る。
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN = { id: "admin", password: "e2e-password-1234", token: "e2e-admin-session-token-0001" };

/** 空いているポートを1つ得る。 */
export function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

/** wrangler.example.toml をローカル専用の設定に変換する(相対パスは絶対パスへ、IDはダミーへ)。 */
export function renderLocalToml(template) {
  return template
    .replace("REPLACE_WITH_YOUR_D1_DATABASE_ID", "00000000-0000-0000-0000-000000000000")
    .replace("REPLACE_WITH_YOUR_R2_BUCKET_NAME", "octopus-e2e")
    .replace(/^main = ".*"$/m, `main = "${join(ROOT, "dist/cloudflare/worker.js")}"`)
    .replace(/^directory = ".*"$/m, `directory = "${join(ROOT, "dist/cloudflare/assets")}"`)
    .replace(/^migrations_dir = ".*"$/m, `migrations_dir = "${join(ROOT, "packages/infrastructures/migrations")}"`);
}

function wrangler(args, options = {}) {
  return execFileSync("npx", ["-y", "wrangler@4", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}

async function waitForReady(base, child, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`wrangler dev が終了しました(code ${child.exitCode})`);
    try {
      const res = await fetch(`${base}/`);
      if (res.ok) return;
    } catch {
      // まだ起動中
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("wrangler dev の起動がタイムアウトしました");
}

export async function main(argv = process.argv.slice(2)) {
  const tests = argv.length ? argv : ["e2e/worker-smoke.mjs"];
  if (!existsSync(join(ROOT, "dist/cloudflare/worker.js"))) {
    throw new Error("dist/cloudflare/worker.js がありません。先に npm run build を実行してください。");
  }
  const dir = mkdtempSync(join(tmpdir(), "octopus-e2e-"));
  const config = join(dir, "wrangler.toml");
  const state = join(dir, "state");
  writeFileSync(config, renderLocalToml(readFileSync(join(ROOT, "wrangler.example.toml"), "utf8")));

  let child = null;
  const cleanup = () => {
    if (child && child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    }
    rmSync(dir, { recursive: true, force: true });
  };
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  try {
    wrangler(["d1", "migrations", "apply", "DB", "--local", "--config", config, "--persist-to", state]);
    execFileSync("node", [join(ROOT, "scripts/seed-local-admin.js"), "--config", config, "--persist-to", state], {
      env: { ...process.env, SEED_ADMIN_ID: ADMIN.id, SEED_ADMIN_PASSWORD: ADMIN.password, SEED_SESSION_TOKEN: ADMIN.token },
      stdio: ["ignore", "ignore", "inherit"],
    });

    const port = await freePort();
    const inspectorPort = await freePort();
    child = spawn(
      "npx",
      ["-y", "wrangler@4", "dev", "--local", "--config", config, "--persist-to", state, "--port", String(port), "--inspector-port", String(inspectorPort)],
      { stdio: ["ignore", "pipe", "pipe"], detached: true }
    );
    let log = "";
    child.stdout.on("data", (d) => (log += d));
    child.stderr.on("data", (d) => (log += d));
    const base = `http://127.0.0.1:${port}`;
    try {
      await waitForReady(base, child);
    } catch (e) {
      console.error(log.split("\n").slice(-30).join("\n"));
      throw e;
    }

    let failed = 0;
    for (const test of tests) {
      console.log(`\n=== ${test} ===`);
      await new Promise((done) => {
        const run = spawn("node", [resolve(ROOT, test)], {
          stdio: "inherit",
          env: { ...process.env, BASE: base, E2E_ADMIN_ID: ADMIN.id, E2E_ADMIN_PASSWORD: ADMIN.password, E2E_ADMIN_TOKEN: ADMIN.token },
        });
        run.on("exit", (code) => {
          if (code !== 0) failed++;
          done();
        });
      });
    }
    return failed;
  } finally {
    cleanup();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().then(
    (failed) => process.exit(failed ? 1 : 0),
    (e) => {
      console.error(e.message);
      process.exit(1);
    }
  );
}
