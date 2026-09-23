/**
 * GAS エンドポイント契約を読み込む共有ローダ。
 *
 * 契約は単一ファイルではなく、各機能パッケージが自分のエンドポイント名一覧を
 * 「唯一の正準定義」として公開し、ここでそれらを集約する:
 *   - apps/app-scheduler/src/server/scheduler-api-contract.ts (octopusScheduler, doGet含む)
 *   - packages/game-jackpot/src/server/jackpot-api-contract.ts (jackpotGame)
 *   - packages/game-quiz/src/server/quiz-api-contract.ts (quizGame)
 *
 * 以下の両方から使うため、ここに集約する:
 *   - `packages/infrastructures/esbuild.config.js`（banner/footer のコード生成）
 *   - `scripts/verify-gas-contract.js`（クライアント呼び出し名との突合）
 *
 * TS ファイルを簡易パースしているのは、ビルドスクリプト（Node）から型定義を
 * 直接 import できないため。各契約ファイルは
 * 「配列内にインラインコメントを書かない」前提でパースしている。
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** リポジトリのルートディレクトリ。 */
export const REPO_ROOT = join(__dirname, "..");

/** 各機能パッケージが公開する契約ファイル。 */
const CONTRACT_SOURCES = [
  {
    path: "apps/app-scheduler/src/server/scheduler-api-contract.ts",
    prefixConst: "OCTOPUS_SCHEDULER_PREFIX",
    endpointsConst: "OCTOPUS_SCHEDULER_ENDPOINTS",
    unprefixedConst: "OCTOPUS_SCHEDULER_UNPREFIXED_ENDPOINTS",
  },
  {
    path: "packages/game-jackpot/src/server/jackpot-api-contract.ts",
    prefixConst: "JACKPOT_GAME_PREFIX",
    endpointsConst: "JACKPOT_GAME_ENDPOINTS",
    // 型付きAPIクライアント(createTypedApiClient)への移行済みモジュールは、
    // DIトークン名を指定する。呼び出し検出ロジックが `@inject(<apiTokenConst>)`
    // からフィールド名を特定し、`this.<field>.<method>(...)` 呼び出しを拾う。
    // 未移行のモジュール(scheduler)は、まだ callOctopusScheduler() ヘルパー経由
    // なので指定しない(HELPER_CALL_RE が引き続き検出する)。
    apiTokenConst: "IJackpotGameApiToken",
  },
  {
    path: "packages/game-quiz/src/server/quiz-api-contract.ts",
    prefixConst: "QUIZ_GAME_PREFIX",
    endpointsConst: "QUIZ_GAME_ENDPOINTS",
    apiTokenConst: "IQuizGameApiToken",
  },
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

/** `export const NAME = "value" as const;` から文字列リテラルを抽出する。 */
function parseConstString(src, constName) {
  const re = new RegExp(
    `export const ${constName}\\s*=\\s*["']([^"']+)["']`
  );
  const m = src.match(re);
  return m ? m[1] : null;
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

/** `export const NAME = ...;` の形の宣言が存在するかどうかを調べる。 */
function hasExportConst(src, constName) {
  return new RegExp(`export const ${constName}\\b`).test(src);
}

/**
 * 契約を読み込み、コード生成・検証に必要な形へ展開する。
 *
 * @returns {{
 *   contractPaths: string[],
 *   endpoints: Record<string, string[]>,
 *   unprefixed: string[],
 *   prefixedNames: string[],
 *   allNames: string[],
 *   internalNames: string[],
 *   ownerOf: (name: string) => string,
 *   apiTokenToPrefix: Record<string, string>,
 * }}
 */
export function loadGasContract() {
  const endpoints = {};
  const unprefixed = [];
  const contractPaths = [];
  const apiTokenToPrefix = {};

  for (const source of CONTRACT_SOURCES) {
    const fullPath = join(REPO_ROOT, source.path);
    if (!existsSync(fullPath)) {
      throw new Error(`GAS エンドポイント契約が見つかりません: ${source.path}`);
    }
    contractPaths.push(fullPath);

    const src = dropLineComments(
      stripBlockComments(readFileSync(fullPath, "utf8"))
    );

    const prefix = parseConstString(src, source.prefixConst);
    const names = parseStringArray(src, source.endpointsConst);
    if (!prefix || !names) {
      throw new Error(
        `契約を解析できませんでした: ${source.path}\n` +
          `\`${source.prefixConst}\` / \`${source.endpointsConst}\` の定義形式を確認してください。`
      );
    }
    endpoints[prefix] = names;

    if (source.unprefixedConst) {
      const unprefixedNames = parseStringArray(src, source.unprefixedConst);
      if (unprefixedNames) unprefixed.push(...unprefixedNames);
    }

    if (source.apiTokenConst) {
      if (!hasExportConst(src, source.apiTokenConst)) {
        throw new Error(
          `契約を解析できませんでした: ${source.path}\n` +
            `\`${source.apiTokenConst}\` が見つかりません(型付きAPIクライアントのDIトークンのexportを確認してください)。`
        );
      }
      apiTokenToPrefix[source.apiTokenConst] = prefix;
    }
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
    contractPaths,
    endpoints,
    unprefixed,
    prefixedNames,
    allNames: [...unprefixed, ...prefixedNames],
    /** esbuild の banner で宣言する内部変数名（`_<prefix>_<name>`）。 */
    internalNames: prefixedNames.map((n) => `_${n}`),
    ownerOf,
    /** DIトークン識別子名(例: "IJackpotGameApiToken") -> そのモジュールのprefix。 */
    apiTokenToPrefix,
  };
}
