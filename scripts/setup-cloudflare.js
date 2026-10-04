#!/usr/bin/env node
/**
 * Cloudflare 環境の自動セットアップ(冪等)。`npm run deploy:cloudflare` から呼ばれる。
 *
 *   1. D1 データベース / R2 バケットが無ければ作成する
 *   2. wrangler.toml が無い(または REPLACE_WITH_* が残っている)場合、
 *      wrangler.example.toml から実リソース名/IDを埋めて生成する
 *
 * 認証は wrangler の通常の方法(`wrangler login` または環境変数
 * CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID)に従う。
 * リソース名は環境変数 CLOUDFLARE_D1_NAME / CLOUDFLARE_R2_BUCKET で変更できる。
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_D1_NAME = "octopus-scheduler-db";
const DEFAULT_R2_BUCKET = "octopus-scheduler-assets";

/** wrangler.toml にプレースホルダが残っているか。 */
export function hasPlaceholders(toml) {
  return /REPLACE_WITH_/.test(toml);
}

/** `wrangler d1 list --json` の結果から name に一致する uuid を返す。無ければ null。 */
export function findD1Id(listJson, name) {
  const found = JSON.parse(listJson).find((db) => db.name === name);
  return found ? found.uuid : null;
}

/** `wrangler r2 bucket list` の出力に bucket が含まれるか。 */
export function r2BucketExists(listOutput, bucket) {
  return listOutput.split("\n").some((line) => {
    const m = line.trim().match(/^name:\s+(\S+)$/);
    return m !== null && m[1] === bucket;
  });
}

/** テンプレートへ実リソースを埋め込む。D1名はテンプレートの database_name も置換する。 */
export function renderWranglerToml(template, { d1Name, d1Id, bucket }) {
  return template
    .replace(/database_name = ".*"/, `database_name = "${d1Name}"`)
    .replace("REPLACE_WITH_YOUR_D1_DATABASE_ID", d1Id)
    .replace("REPLACE_WITH_YOUR_R2_BUCKET_NAME", bucket);
}

/**
 * セットアップ本体。run(args) は wrangler を実行して標準出力を返す関数(テストで差し替える)。
 * 作成した/確認したリソースを返す。
 */
export function setup({ run, readTemplate, existingToml, d1Name, bucket }) {
  if (existingToml !== null && !hasPlaceholders(existingToml)) {
    return { toml: null, created: [] };
  }
  const created = [];

  let d1Id = findD1Id(run(["d1", "list", "--json"]), d1Name);
  if (!d1Id) {
    run(["d1", "create", d1Name]);
    created.push(`D1:${d1Name}`);
    d1Id = findD1Id(run(["d1", "list", "--json"]), d1Name);
    if (!d1Id) throw new Error(`D1 database '${d1Name}' was created but its id could not be found.`);
  }

  if (!r2BucketExists(run(["r2", "bucket", "list"]), bucket)) {
    run(["r2", "bucket", "create", bucket]);
    created.push(`R2:${bucket}`);
  }

  return { toml: renderWranglerToml(readTemplate(), { d1Name, d1Id, bucket }), created };
}

function main() {
  const tomlPath = join(ROOT, "wrangler.toml");
  const run = (args) =>
    execFileSync("npx", ["wrangler", ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

  const result = setup({
    run,
    readTemplate: () => readFileSync(join(ROOT, "wrangler.example.toml"), "utf8"),
    existingToml: existsSync(tomlPath) ? readFileSync(tomlPath, "utf8") : null,
    d1Name: process.env.CLOUDFLARE_D1_NAME || DEFAULT_D1_NAME,
    bucket: process.env.CLOUDFLARE_R2_BUCKET || DEFAULT_R2_BUCKET,
  });

  if (result.toml === null) {
    console.log("wrangler.toml は設定済みのため、リソース作成をスキップしました。");
    return;
  }
  writeFileSync(tomlPath, result.toml);
  console.log(
    `wrangler.toml を生成しました。${result.created.length ? `作成: ${result.created.join(", ")}` : "既存リソースを使用"}`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
