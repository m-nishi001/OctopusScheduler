#!/usr/bin/env node
/**
 * GAS エンドポイント契約の整合性検証スクリプト。
 *
 * 検証する 2 点:
 *   A. クライアントが呼ぶ名前 ⊆ 各機能パッケージが公開する契約(scripts/gas-contract.js)
 *      → タイポや「サーバに存在しない関数の呼び出し」を検出する
 *   B. ビルド成果物 `dist/gas` に契約どおりのトップレベル関数が存在する（成果物がある場合のみ）
 *      → 「宣言はあるが実装がない」を検出する
 *
 * 背景: GAS の `google.script.run` はトップレベル関数しか呼べず型を持たないため、
 * 呼び出し名のズレが tsc では検出できなかった。このスクリプトがその代わりを担う
 * (もっとも、型付きAPIクライアント(`createTypedApiClient()` が返す `xxxApi.method()`)
 * 経由の呼び出しはエンドポイント名が契約側の型で制約されており、その分は
 * tsc 自体が検出できる)。
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { loadGasContract } from "./gas-contract.js";

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

// ---------------------------------------------------------------------------
// 1. 契約（唯一の正準定義）を読む
// ---------------------------------------------------------------------------
let contract;
try {
  contract = loadGasContract();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const { contractPaths, endpoints: endpointMap, apiTokenToPrefix } = contract;
const expected = new Set(contract.allNames);

info.push(`契約: ${contractPaths.map(rel).join(", ")}`);
info.push(
  `契約エンドポイント: ${expected.size} 件（${Object.keys(endpointMap).length} 接頭辞）`
);

// ---------------------------------------------------------------------------
// 2. A: クライアントが呼ぶ名前を収集して契約と突合
// ---------------------------------------------------------------------------
const sourceFiles = [
  ...listSourceFiles(join(ROOT, "apps")),
  ...listSourceFiles(join(ROOT, "packages")),
].filter((f) => /\.(ts|tsx|vue|mts|js)$/.test(f));

// 旧: new GasFunctionService("prefix_name") の直接呼び出し(型付きAPIクライアントを
// 経由しない、より低レベルな迂回があれば検出する)。
const LEGACY_CALL_RE = /GasFunctionService\(\s*["']([^"']+)["']/g;

const called = new Map(); // name -> [files]

for (const file of sourceFiles) {
  if (contractPaths.includes(file)) continue;
  let src;
  try {
    src = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  if (src.includes("GasFunctionService")) {
    for (const m of src.matchAll(LEGACY_CALL_RE)) {
      const name = m[1];
      if (!called.has(name)) called.set(name, []);
      called.get(name).push(rel(file));
    }
  }

  // `@inject(IXxxGameApiToken) private readonly foo: XxxGameApi` で受け取った
  // フィールド経由の `this.foo.method(...)` 呼び出し(型付きAPIクライアント)。
  for (const [tokenName, prefix] of Object.entries(apiTokenToPrefix)) {
    if (!src.includes(tokenName)) continue;
    const injectRe = new RegExp(
      `@inject\\(${tokenName}\\)\\s*(?:private\\s+)?(?:readonly\\s+)?(\\w+)`,
      "g"
    );
    for (const injectMatch of src.matchAll(injectRe)) {
      const field = injectMatch[1];
      const callRe = new RegExp(`\\bthis\\.${field}\\.(\\w+)\\s*\\(`, "g");
      for (const callMatch of src.matchAll(callRe)) {
        const name = `${prefix}_${callMatch[1]}`;
        if (!called.has(name)) called.set(name, []);
        called.get(name).push(rel(file));
      }
    }
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

const unusedInClient = [...expected].filter(
  (n) => !called.has(n) && !contract.unprefixed.includes(n)
);
if (unusedInClient.length > 0) {
  warnings.push(
    `[A] クライアントから呼ばれていないエンドポイントが ${unusedInClient.length} 件あります:\n` +
      unusedInClient.map((n) => `      - ${n}`).join("\n")
  );
}


// ---------------------------------------------------------------------------
// 3. B: ビルド成果物 dist/gas にトップレベル関数が存在するか
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
      `[B] 契約にあるが dist/gas に公開関数がありません（${missing.length} 件）:\n` +
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