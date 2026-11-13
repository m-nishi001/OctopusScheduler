#!/usr/bin/env node
/**
 * 利用マニュアル(docs/markdown/manual)の画面写真を、1コマンドで撮り直す。
 *
 *   npm run docs:shots -- [--assets <写真のフォルダ>] [--only <画像名の正規表現>] [--out <書き出し先>] [--base <URL> --token <管理者トークン>]
 *
 *   1. `npm run build`(turbo のキャッシュが効く。dist が今のソースと一致していないと dev-stack が起動しないため)をしてから、ローカルの wrangler(`dev-stack`、架空データ入り)を空きポートで起動する(Cloudflare 上の環境には一切触れない)
 *   2. e2e/ui/manual-screenshots.spec.ts(Playwright)を流して、docs/assets/images/*.webp に同じ名前で書き出す
 *   3. 終わったら wrangler を止める
 *
 * --assets: 人物写真(person-*.jpg)・景品/果物の写真(wiki-*.jpg)を置いたフォルダ。出典は docs/markdown/manual/credits.md。
 *           省略(または環境変数 DOCS_SHOTS_ASSETS が無い)と、生成した色つきの画像で代用する。
 * --only:   撮る画像を名前の正規表現で絞る(例: --only '^a-1')。
 * --out:    書き出し先(既定は docs/assets/images)。
 * --base / --token: すでに起動している dev-stack を使う(起動・停止はしない。データは撮影で書き換わる)。
 * 公開リポジトリなので、実際のID・パスワード・キーは使わない。管理者トークンはこのプロセスの環境変数でだけ渡し、ファイルには残さない。
 */
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { freePort } from "./e2e-local.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** コマンドライン引数を解釈する。 */
export function parseArgs(argv) {
  const out = { assets: process.env.DOCS_SHOTS_ASSETS, only: process.env.DOCS_SHOTS_ONLY, out: process.env.DOCS_SHOTS_OUT, base: undefined, token: undefined, extra: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      out.extra = argv.slice(i + 1);
      break;
    }
    const key = { "--assets": "assets", "--only": "only", "--out": "out", "--base": "base", "--token": "token" }[a];
    if (!key) throw new Error(`不明な引数: ${a}(--assets / --only / --out / --base / --token)`);
    out[key] = argv[++i];
    if (out[key] === undefined) throw new Error(`${a} に値がありません`);
  }
  if (Boolean(out.base) !== Boolean(out.token)) throw new Error("--base と --token は一緒に指定してください");
  return out;
}

/** dev-stack を起動し、準備できたら { base, token, stop } を返す。 */
async function startStack() {
  const port = await freePort();
  const child = spawn("node", [join(ROOT, "scripts/dev-stack.js"), "--port", String(port), "--reset"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  const ready = new Promise((resolveReady, reject) => {
    const onData = (d) => {
      log += d;
      const base = log.match(/アプリ\s*:\s*(\S+?)\/?\s/)?.[1];
      const token = log.match(/管理者トークン\s*:\s*([^\s(]+)/)?.[1];
      if (log.includes("Ctrl-C で停止") && base && token) resolveReady({ base, token });
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (d) => (log += d));
    child.on("exit", (code) => reject(new Error(`dev-stack が終了しました(code ${code})\n${log.split("\n").slice(-15).join("\n")}`)));
  });
  const stop = () =>
    new Promise((done) => {
      if (child.exitCode !== null) return done();
      child.once("exit", () => done());
      child.kill("SIGINT"); // dev-stack が wrangler(別プロセスグループ)も止める
      setTimeout(() => child.kill("SIGKILL"), 15_000).unref();
    });
  return { ...(await ready), stop };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.base) {
    const built = spawnSync("npm", ["run", "build"], { cwd: ROOT, stdio: "inherit" });
    if (built.status !== 0) throw new Error("npm run build に失敗しました");
  }
  const stack = args.base ? { base: args.base, token: args.token, stop: async () => {} } : await startStack();
  let code = 1;
  try {
    const env = {
      ...process.env,
      E2E_SEEDED: "1",
      BASE: stack.base,
      E2E_ADMIN_TOKEN: stack.token,
      ...(args.assets ? { DOCS_SHOTS_ASSETS: resolve(args.assets) } : {}),
      ...(args.only ? { DOCS_SHOTS_ONLY: args.only } : {}),
      DOCS_SHOTS_OUT: resolve(args.out ?? join(ROOT, "docs/assets/images")),
    };
    code = await new Promise((done) => {
      const p = spawn("npx", ["playwright", "test", "-c", join(ROOT, "e2e/playwright.config.ts"), "manual-screenshots", ...args.extra], { cwd: ROOT, env, stdio: "inherit" });
      p.on("exit", (c) => done(c ?? 1));
    });
  } finally {
    await stack.stop();
  }
  return code;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(e.message);
      process.exit(1);
    }
  );
}
