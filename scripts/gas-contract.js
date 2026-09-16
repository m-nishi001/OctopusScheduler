/**
 * GAS エンドポイント契約（`@octopus/core` の `api-contract.ts`）を読み込む共有ローダ。
 *
 * 以下の両方から使うため、ここに集約する:
 *   - `packages/server/esbuild.config.js`（banner/footer のコード生成）
 *   - `scripts/verify-gas-contract.js`（クライアント呼び出し名との突合）
 *
 * TS ファイルを簡易パースしているのは、ビルドスクリプト（Node）から型定義を
 * 直接 import できないため。`api-contract.ts` は
 * 「配列内にインラインコメントを書かない」前提でパースしている。
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** リポジトリのルートディレクトリ。 */
export const REPO_ROOT = join(__dirname, "..");

/** 契約ファイルの候補パス（レイアウト移行中も解決できるようにする）。 */
export const CONTRACT_CANDIDATES = [
  "packages/core/src/gas/api-contract.ts",
];

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

/**
 * 契約を読み込み、コード生成・検証に必要な形へ展開する。
 *
 * @returns {{
 *   contractPath: string,
 *   endpoints: Record<string, string[]>,
 *   unprefixed: string[],
 *   prefixedNames: string[],
 *   allNames: string[],
 *   internalNames: string[],
 *   ownerOf: (name: string) => string,
 * }}
 */
export function loadGasContract() {
  const contractPath = CONTRACT_CANDIDATES.map((p) => join(REPO_ROOT, p)).find(
    (p) => existsSync(p)
  );

  if (!contractPath) {
    throw new Error(
      "GAS エンドポイント契約が見つかりません。想定パス:\n" +
        CONTRACT_CANDIDATES.map((p) => `  - ${p}`).join("\n")
    );
  }

  const src = dropLineComments(
    stripBlockComments(readFileSync(contractPath, "utf8"))
  );
  const endpoints = parseEndpointMap(src, "GAS_ENDPOINTS");
  const unprefixed = parseStringArray(src, "GAS_UNPREFIXED_ENDPOINTS");

  if (!endpoints || !unprefixed) {
    throw new Error(
      `契約を解析できませんでした: ${contractPath}\n` +
        "`GAS_ENDPOINTS` / `GAS_UNPREFIXED_ENDPOINTS` の定義形式を確認してください。"
    );
  }

  const prefixedNames = [];
  for (const [prefix, names] of Object.entries(endpoints)) {
    for (const name of names) {
      if (unprefixed.includes(name)) continue;
      prefixedNames.push(`${prefix}_${name}`);
    }
  }

  /** 接頭辞なしで公開する関数を実装している接頭辞（例: doGet -> octopusScheduler）。 */
  const ownerOf = (name) => {
    for (const [prefix, names] of Object.entries(endpoints)) {
      if (names.includes(name)) return prefix;
    }
    return null;
  };

  return {
    contractPath,
    endpoints,
    unprefixed,
    prefixedNames,
    allNames: [...unprefixed, ...prefixedNames],
    /** esbuild の banner で宣言する内部変数名（`_<prefix>_<name>`）。 */
    internalNames: prefixedNames.map((n) => `_${n}`),
    ownerOf,
  };
}
