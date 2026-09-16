#!/usr/bin/env node
/**
 * ビルド成果物 `dist/`（特に clasp の rootDir である `dist/gas/`）の内容検証。
 *
 * GAS プロジェクトに配布してはいけない成果物の混入を検出する:
 *   - TypeScript のビルドキャッシュ (`*.tsbuildinfo`)
 *   - 型定義 (`*.d.ts`) / ソースマップ (`*.map`)
 *   - トップレベル関数を 1 つも公開しない（= google.script.run から到達できない）空のバンドル
 *
 * 背景: `prepare-dist.js` が拡張子でフィルタせず全ファイルを平坦コピーしていたため、
 * 103KB の `tsconfig.tsbuildinfo` や、グローバルを公開しない IIFE が本番に配布されていた。
 */
import { readdirSync, existsSync, readFileSync, statSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");
const GAS_DIST = join(DIST, "gas");

const FORBIDDEN = [
  { re: /\.tsbuildinfo$/i, why: "TypeScript のビルドキャッシュ" },
  { re: /\.d\.ts$/i, why: "型定義ファイル（GAS では不要）" },
  { re: /\.map$/i, why: "ソースマップ" },
  { re: /\.log$/i, why: "ビルドログ" },
];

const REQUIRED = ["appsscript.json", "index.html"];

const errors = [];
const warnings = [];
const info = [];

function rel(p) {
  return relative(ROOT, p) || ".";
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** トップレベル（行頭）の関数宣言を数える。IIFE 内に閉じた関数は数えない。 */
function topLevelFunctionNames(src) {
  return [...src.matchAll(/(?:^|\n)function\s+([A-Za-z0-9_$]+)\s*\(/g)].map(
    (m) => m[1]
  );
}

if (!existsSync(DIST)) {
  console.error(`dist が存在しません: ${rel(DIST)}\n  npm run build を実行してください。`);
  process.exit(1);
}

if (!existsSync(GAS_DIST)) {
  console.warn(
    `dist/gas が存在しません（clasp の rootDir）: ${rel(GAS_DIST)}\n` +
      "  npm run build を実行してください。"
  );
  process.exit(0);
}

const gasFiles = walk(GAS_DIST);
info.push(`dist/gas: ${gasFiles.length} ファイル`);

// 1. 必須ファイル
for (const name of REQUIRED) {
  if (!existsSync(join(GAS_DIST, name))) {
    errors.push(`[1] dist/gas に必須ファイルがありません: ${name}`);
  }
}

// 2. 禁止ファイルの混入
for (const file of gasFiles) {
  const base = file.split("/").pop();
  for (const { re, why } of FORBIDDEN) {
    if (re.test(base)) {
      errors.push(
        `[2] dist/gas に不要な成果物が混入しています: ${rel(file)}（${why}）`
      );
    }
  }
}

// 3. 空のバンドル（公開関数ゼロ）の検出
const bundles = gasFiles.filter((f) => f.endsWith(".js"));
let exportedTotal = 0;
for (const bundle of bundles) {
  const src = readFileSync(join(GAS_DIST, bundle.split("/").pop()), "utf8");
  const names = topLevelFunctionNames(src);
  exportedTotal += names.length;
  if (names.length === 0) {
    errors.push(
      `[3] dist/gas のバンドルがトップレベル関数を公開していません: ${rel(bundle)}\n` +
        "      google.script.run から到達できないため配布しても意味がありません。"
    );
  } else {
    info.push(`  ${rel(bundle)}: ${names.length} 関数 (${statSync(bundle).size} bytes)`);
  }
}

info.push(`dist/gas の公開関数合計: ${exportedTotal} 件 / バンドル ${bundles.length} 件`);

if (bundles.length > 4) {
  warnings.push(
    `[4] dist/gas のバンドル数が ${bundles.length} 件あります。` +
      "単一 GAS プロジェクトに多数のバンドルを同居させると、グローバル名衝突を避けるための" +
      "コード生成が必要になります（@octopus/server への統合を検討）。"
  );
}

console.log("=== ビルド成果物検証 ===");
for (const line of info) console.log(`  ${line}`);
console.log("");

if (warnings.length > 0) {
  console.log("--- 警告 ---");
  for (const w of warnings) console.log(`  ${w}`);
  console.log("");
}

if (errors.length > 0) {
  console.log("--- エラー ---");
  for (const e of errors) console.log(`  ${e}`);
  console.log("");
  console.log(`NG: ${errors.length} 件の問題があります。`);
  process.exit(1);
}

console.log("OK: dist/gas は GAS プロジェクトとして妥当な内容です。");