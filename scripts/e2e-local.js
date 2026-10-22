#!/usr/bin/env node
/**
 * ローカルの実 workerd(`wrangler dev --local`)に対する E2E 実行ランナー。
 *
 *   1. wrangler.example.toml から**ローカル専用**の設定を一時ディレクトリに生成する
 *      (ダミーのD1 ID。リモートのリソースには一切触れない。リポジトリにも置かない)
 *   2. ローカルD1にマイグレーションを適用し、管理者アカウントとログイン済みセッションを投入する
 *   3. wrangler dev を起動して準備できるまで待ち、テストコマンドを実行し、終了時に必ず停止する
 *
 * 使い方: node scripts/e2e-local.js [--target gas] [worker-smoke] [ui] [-- playwrightの引数]   (既定: 両方)
 *   --target gas: wrangler の代わりに GAS 実行環境シミュレーター(scripts/gas-sim)に対して ui を流す(要 dist/gas。Cloudflare 専用のテストは除く)
 *   worker-smoke: 実 workerd に対する REST / WebSocket / Durable Object の疎通(Node)
 *   ui          : Playwright で複数の端末(ブラウザコンテキスト)を動かす画面の通しテスト
 * 事前に `npm run build` が必要(dist/cloudflare/worker.js を使う)。
 * テストには環境変数 BASE / E2E_ADMIN_TOKEN / E2E_ADMIN_ID / E2E_ADMIN_PASSWORD が渡る。
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runWrangler, wranglerCommand } from "./lib/wrangler.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN = { id: "admin", password: "e2e-password-1234", token: "e2e-admin-session-token-0001" };

/** 実行できるテスト。key はコマンドライン引数。 */
export const TARGETS = {
  "worker-smoke": () => ["node", [join(ROOT, "e2e/worker-smoke.mjs")]],
  ui: (extra) => ["npx", ["playwright", "test", "-c", join(ROOT, "e2e/playwright.config.ts"), ...extra]],
  // 負荷テスト(参加者50人 + 運営3端末のフルコース)。時間がかかるので、名前を指定したときだけ動かす。
  load: () => ["node", [join(ROOT, "e2e/load/full-course.mjs")]],
  // 負荷テストの画面つき版(実ブラウザのホスト・管理・参加者3 + 合成の参加者47)。
  "load-ui": (extra) => ["npx", ["playwright", "test", "-c", join(ROOT, "e2e/load/playwright.config.ts"), ...extra]],
};

/** 引数なしで動かすテスト。 */
export const DEFAULT_TARGETS = ["worker-smoke", "ui"];

/** 実行環境。`cloudflare` は実 workerd(wrangler dev --local)、`gas` は GAS 実行環境シミュレーター(scripts/gas-sim)。 */
export const PLATFORMS = ["cloudflare", "gas"];

/** GAS シミュレーターで動かせるテスト(worker-smoke / load は Cloudflare 専用)。 */
export const GAS_TARGETS = ["ui"];

/** コマンドライン引数を { targets, extra, platform }(-- 以降は Playwright へ渡す。`--target gas` で GAS)に分ける。 */
export function parseArgs(argv) {
  const dd = argv.indexOf("--");
  const head = dd === -1 ? argv : argv.slice(0, dd);
  const extra = dd === -1 ? [] : argv.slice(dd + 1);
  let platform = "cloudflare";
  const names = [];
  for (let i = 0; i < head.length; i++) {
    if (head[i] === "--target") platform = head[++i] ?? "";
    else if (head[i].startsWith("--target=")) platform = head[i].slice("--target=".length);
    else names.push(head[i]);
  }
  if (!PLATFORMS.includes(platform)) throw new Error(`不明な --target: ${platform}(${PLATFORMS.join(" / ")})`);
  const targets = names.length ? names : platform === "gas" ? GAS_TARGETS : DEFAULT_TARGETS;
  const unknown = targets.filter((t) => !(t in TARGETS));
  if (unknown.length) throw new Error(`不明なテスト: ${unknown.join(", ")}(${Object.keys(TARGETS).join(" / ")})`);
  const unsupported = platform === "gas" ? targets.filter((t) => !GAS_TARGETS.includes(t)) : [];
  if (unsupported.length) throw new Error(`--target gas では動かせないテスト: ${unsupported.join(", ")}(Cloudflare 専用。動かせるのは ${GAS_TARGETS.join(" / ")})`);
  return { targets, extra, platform };
}

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

/**
 * 遅延の組み合わせ。`staging` は、参加者50の負荷テストで staging のログイン p99(約4秒)に近づく値
 * (R2 80ms / D1 30ms)。個別の SIM_*_LATENCY_MS を指定するとそちらが優先される。
 */
export const LATENCY_PRESETS = {
  staging: { SIM_R2_LATENCY_MS: "80", SIM_D1_LATENCY_MS: "30" },
};

/**
 * R2 / D1 に足す遅延(ミリ秒)を、環境変数 SIM_R2_LATENCY_MS / SIM_D1_LATENCY_MS から wrangler の `[vars]` に変換する。
 * どちらも未設定なら空文字(遅延なし)。数値以外・0以下は不正としてエラーにする。
 * Worker 側(packages/infrastructures/src/cloudflare/simulated-latency.ts)がこの値で呼び出しを遅らせる。
 */
export function simulatedLatencyVars(env = process.env) {
  const lines = [];
  const preset = env.SIM_LATENCY ? LATENCY_PRESETS[env.SIM_LATENCY] : undefined;
  if (env.SIM_LATENCY && !preset) {
    throw new Error(`SIM_LATENCY は ${Object.keys(LATENCY_PRESETS).join(" / ")} のいずれかを指定してください: ${env.SIM_LATENCY}`);
  }
  for (const name of ["SIM_R2_LATENCY_MS", "SIM_D1_LATENCY_MS"]) {
    const raw = env[name] ?? preset?.[name];
    if (raw === undefined || raw === "") continue;
    const ms = Number(raw);
    if (!Number.isFinite(ms) || ms <= 0) throw new Error(`${name} は 0 より大きい数値(ミリ秒)で指定してください: ${raw}`);
    lines.push(`${name} = "${ms}"`);
  }
  return lines.length ? `\n[vars]\n${lines.join("\n")}\n` : "";
}

export function wrangler(args, options = {}) {
  return runWrangler(args, { stdio: ["ignore", "pipe", "pipe"], ...options });
}

export async function waitForReady(base, child, timeoutMs = 120_000) {
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

/** テストコマンドを順に実行する。失敗した数を返す。 */
async function runTargets(targets, extra, base, platform) {
  let failed = 0;
  for (const target of targets) {
    console.log(`\n=== ${target}${platform === "gas" ? " (gas)" : ""} ===`);
    const [cmd, args] = TARGETS[target](extra);
    await new Promise((done) => {
      const run = spawn(cmd, args, {
        cwd: ROOT,
        stdio: "inherit",
        env: { ...process.env, BASE: base, E2E_TARGET: platform, E2E_ADMIN_ID: ADMIN.id, E2E_ADMIN_PASSWORD: ADMIN.password, E2E_ADMIN_TOKEN: ADMIN.token },
      });
      run.on("exit", (code) => {
        if (code !== 0) failed++;
        done();
      });
    });
  }
  return failed;
}

/** GAS シミュレーターを起動して(GAS 方式でシード済み)、テストを流す。外部へのアクセスは無い。 */
async function mainGas(targets, extra) {
  if (!existsSync(join(ROOT, "dist/gas/server.js"))) {
    throw new Error("dist/gas/server.js がありません。先に npm run build を実行してください。");
  }
  const { startSimulator } = await import("./gas-sim/simulator.js");
  const { SimState } = await import("./gas-sim/state.js");
  const { seedAdmin } = await import("./gas-sim/seed.js");
  const state = new SimState();
  seedAdmin(state, { id: ADMIN.id, password: ADMIN.password, token: ADMIN.token });
  const sim = await startSimulator({ serverPath: join(ROOT, "dist/gas/server.js"), htmlDir: join(ROOT, "dist/gas"), state });
  console.log(`GAS シミュレーター: ${sim.url}(同時実行 ${process.env.GAS_SIM_CONCURRENCY ?? 20}、遅延 ${process.env.GAS_SIM_LATENCY_MS ?? 200}ms)`);
  try {
    const failed = await runTargets(targets, extra, sim.url, "gas");
    console.log(`GAS シミュレーター統計: ${JSON.stringify(sim.stats)}`);
    return failed;
  } finally {
    await sim.close();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { targets, extra, platform } = parseArgs(argv);
  if (platform === "gas") return mainGas(targets, extra);
  if (!existsSync(join(ROOT, "dist/cloudflare/worker.js"))) {
    throw new Error("dist/cloudflare/worker.js がありません。先に npm run build を実行してください。");
  }
  const dir = mkdtempSync(join(tmpdir(), "octopus-e2e-"));
  const config = join(dir, "wrangler.toml");
  const state = join(dir, "state");
  writeFileSync(config, renderLocalToml(readFileSync(join(ROOT, "wrangler.example.toml"), "utf8")) + simulatedLatencyVars());

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
    const [wranglerFile, wranglerPrefix] = wranglerCommand();
    child = spawn(
      wranglerFile,
      [...wranglerPrefix, "dev", "--local", "--config", config, "--persist-to", state, "--port", String(port), "--inspector-port", String(inspectorPort)],
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

    const failed = await runTargets(targets, extra, base, "cloudflare");
    if (failed) {
      // 失敗の原因が Worker 側のエラーのことがあるので、wrangler のログからエラー行を残す。
      const errors = log.split("\n").filter((line) => /error|exception/i.test(line));
      if (errors.length) console.error(`\n── wrangler dev のエラーログ(末尾 40 行)\n${errors.slice(-40).join("\n")}`);
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
