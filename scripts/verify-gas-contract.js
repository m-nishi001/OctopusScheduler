#!/usr/bin/env node
/**
 * GAS エンドポイント契約の整合性検証スクリプト。
 *
 * 検証する 3 点:
 *   A. クライアントが呼ぶ名前 ⊆ `@octopus/core` の契約（`GAS_ENDPOINTS`）
 *      → タイポや「サーバに存在しない関数の呼び出し」を検出する
 *   B. 契約 == サーバの esbuild 設定が公開する名前（設定が存在する場合のみ）
 *      → 二重管理のズレを検出する（契約からコード生成するようになったら不要）
 *   C. ビルド成果物 `dist/gas` に契約どおりのトップレベル関数が存在する（成果物がある場合のみ）
 *      → 「宣言はあるが実装がない」を検出する
 *
 * 背景: GAS の `google.script.run` はトップレベル関数しか呼べず型を持たないため、
 * 呼び出し名のズレが tsc では検出できなかった。このスクリプトがその代わりを担う。
 *
 * 注意: `api-contract.ts` の正準定義は「配列内にインラインコメントを書かない」前提で
 * 簡易パースしている（行頭 `//` コメントとブロックコメントのみ許容）。
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".git",
  ".vscode",
  "coverage",
]);

const CONTRACT_CANDIDATES = [
  "packages/core/src/gas/api-contract.ts",
  "src/core/src/gas/api-contract.ts",
];

const errors = [];
const warnings = [];
const info = [];

function rel(p) {
  return relative(ROOT, p) || ".";
}

/** 再帰的にソースファイルを列挙する（node_modules / dist 等を除く）。 */
function listSourceFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      out.push(...listSourceFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function stripBlockComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "");
}

function dropLineComments(src) {
  return src
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/** `export const NAME = [ ... ] as const;` から文字列リテラルを抽出する。 */
function parseStringArray(src, constName) {
  const start = src.indexOf(`export const ${constName}`);
  if (start === -1) return null;
  const open = src.indexOf("[", start);
  const close = src.indexOf("]", open);
  if (open === -1 || close === -1) return null;
  const body = src.slice(open + 1, close);
  return [...body.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

/** `export const NAME = { key: [ ... ], ... } as const;` を { key: string[] } に変換する。 */
function parseEndpointMap(src, constName) {
  const start = src.indexOf(`export const ${constName}`);
  if (start === -1) return null;
  const open = src.indexOf("{", start);
  const end = src.indexOf("} as const", open);
  if (open === -1 || end === -1) return null;
  const body = src.slice(open + 1, end);

  const map = {};
  for (const m of body.matchAll(/([A-Za-z0-9_$]+)\s*:\s*\[([^\]]*)\]/g)) {
    map[m[1]] = [...m[2].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
  }
  return map;
}

// ---------------------------------------------------------------------------
// 1. 契約（唯一の正準定義）を読む
// ---------------------------------------------------------------------------
const contractPath = CONTRACT_CANDIDATES.map((p) => join(ROOT, p)).find((p) =>
  existsSync(p)
);

if (!contractPath) {
  console.error(
    "GAS エンドポイント契約が見つかりません。想定パス:\n" +
      CONTRACT_CANDIDATES.map((p) => `  - ${p}`).join("\n")
  );
  process.exit(1);
}

const contractSrc = dropLineComments(
  stripBlockComments(readFileSync(contractPath, "utf8"))
);
const endpointMap = parseEndpointMap(contractSrc, "GAS_ENDPOINTS");
const unprefixed = parseStringArray(contractSrc, "GAS_UNPREFIXED_ENDPOINTS");

if (!endpointMap || !unprefixed) {
  console.error(
    `契約を解析できませんでした: ${rel(contractPath)}\n` +
      "`GAS_ENDPOINTS` / `GAS_UNPREFIXED_ENDPOINTS` の定義形式を確認してください。"
  );
  process.exit(1);
}

const expected = new Set(unprefixed);
for (const [prefix, names] of Object.entries(endpointMap)) {
  for (const name of names) {
    if (unprefixed.includes(name)) continue;
    expected.add(`${prefix}_${name}`);
  }
}

info.push(`契約: ${rel(contractPath)}`);
info.push(
  `契約エンドポイント: ${expected.size} 件（${Object.keys(endpointMap).length} 接頭辞）`
);

// ---------------------------------------------------------------------------
// 2. A: クライアントが呼ぶ名前を収集して契約と突合
// ---------------------------------------------------------------------------
const sourceFiles = [
  ...listSourceFiles(join(ROOT, "apps")),
  ...listSourceFiles(join(ROOT, "packages")),
  ...listSourceFiles(join(ROOT, "src")),
].filter((f) => /\.(ts|tsx|vue|mts|js)$/.test(f));

const CALL_RE = /GasFunctionService\(\s*["']([^"']+)["']/g;
const called = new Map(); // name -> [files]

for (const file of sourceFiles) {
  if (file === contractPath) continue;
  let src;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!src.includes("GasFunctionService")) continue;

  for (const m of src.matchAll(CALL_RE)) {
    const name = m[1];
    if (!called.has(name)) called.set(name, []);
    called.get(name).push(rel(file));
  }
}

info.push(`クライアント呼び出し: ${called.size} 種類`);

for (const [name, files] of called) {
  if (!expected.has(name)) {
    errors.push(
      `[A] 契約に存在しない GAS 関数を呼んでいます: "${name}"\n` +
        files.map((f) => `      - ${f}`).join("\n")
    );
  }
}

const unusedInClient = [...expected].filter((n) => !called.has(n));
if (unusedInClient.length > 0) {
  warnings.push(
    `[A] クライアントから呼ばれていないエンドポイントが ${unusedInClient.length} 件あります:\n` +
      unusedInClient.map((n) => `      - ${n}`).join("\n")
  );
}

// ---------------------------------------------------------------------------
// 3. B: サーバの esbuild 設定（手書きの internalNames）と突合
// ---------------------------------------------------------------------------
function findServerEsbuildConfigs() {
  const configs = [];
  const single = join(ROOT, "packages/server/esbuild.config.js");
  if (existsSync(single)) configs.push(single);

  const legacyDir = join(ROOT, "src/server");
  if (existsSync(legacyDir)) {
    for (const p of listSourceFiles(legacyDir)) {
      if (p.endsWith("esbuild.config.js")) configs.push(p);
    }
  }
  return configs;
}

/** esbuild の `derivePrefix()` と同じ規則で接頭辞を求める。 */
function toCamelCase(name) {
  return name
    .replace(/[-_]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (m) => m.toLowerCase());
}

const declared = new Set();
const configsWithInternalNames = [];

for (const config of findServerEsbuildConfigs()) {
  const src = readFileSync(config, "utf8");
  const names = parseStringArray(
    dropLineComments(stripBlockComments(src)),
    "internalNames"
  );
  if (!names) continue;

  configsWithInternalNames.push(config);

  let prefix = null;
  const pkgPath = join(dirname(config), "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      prefix = toCamelCase(String(pkg.name || "").replace(/-api$/, ""));
    } catch {
      /* ignore */
    }
  }
  if (!prefix) {
    warnings.push(
      `[B] 接頭辞を解決できませんでした（package.json の name が必要）: ${rel(config)}`
    );
    continue;
  }

  for (const name of names) {
    declared.add(unprefixed.includes(name) ? name : `${prefix}_${name}`);
  }
}

if (configsWithInternalNames.length > 0) {
  info.push(
    `esbuild 設定の宣言: ${declared.size} 件（${configsWithInternalNames.length} ファイル）`
  );

  const missingInConfig = [...expected].filter((n) => !declared.has(n));
  const extraInConfig = [...declared].filter((n) => !expected.has(n));

  if (missingInConfig.length > 0) {
    errors.push(
      `[B] 契約にあるが esbuild 設定が公開していません（${missingInConfig.length} 件）:\n` +
        missingInConfig.map((n) => `      - ${n}`).join("\n")
    );
  }
  if (extraInConfig.length > 0) {
    errors.push(
      `[B] esbuild 設定が公開しているが契約にありません（${extraInConfig.length} 件）:\n` +
        extraInConfig.map((n) => `      - ${n}`).join("\n")
    );
  }
}

// ---------------------------------------------------------------------------
// 4. C: ビルド成果物 dist/gas にトップレベル関数が存在するか
// ---------------------------------------------------------------------------
const gasDir = join(ROOT, "dist", "gas");
if (existsSync(gasDir)) {
  const bundles = readdirSync(gasDir).filter((f) => f.endsWith(".js"));
  const exported = new Set();

  for (const bundle of bundles) {
    const src = readFileSync(join(gasDir, bundle), "utf8");
    // フッタのトップレベル関数宣言のみを対象にする
    for (const m of src.matchAll(/(?:^|\n)function\s+([A-Za-z0-9_$]+)\s*\(/g)) {
      exported.add(m[1]);
    }
  }

  info.push(`dist/gas の公開関数: ${exported.size} 件（${bundles.length} バンドル）`);

  const missing = [...expected].filter((n) => !exported.has(n));
  if (missing.length > 0) {
    errors.push(
      `[C] 契約にあるが dist/gas に公開関数がありません（${missing.length} 件）:\n` +
        missing.map((n) => `      - ${n}`).join("\n") +
        "\n      ※ npm run build 後に再実行してください"
    );
  }
} else {
  warnings.push(
    "[C] dist/gas が無いため成果物検証をスキップしました（npm run build 後に再実行可）"
  );
}

// ---------------------------------------------------------------------------
// レポート
// ---------------------------------------------------------------------------
console.log("=== GAS エンドポイント契約検証 ===");
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
  console.log(`NG: ${errors.length} 件の不整合があります。`);
  process.exit(1);
}

console.log("OK: クライアントの呼び出し名とサーバの公開名は契約に一致しています。");