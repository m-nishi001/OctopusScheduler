// distディレクトリ集約用スクリプト
// サーバ（packages/infrastructures、GASバンドル）の dist と、クライアント（apps/app-scheduler）の dist を
// dist/ 直下へフラットに集約し、clasp の rootDir である dist/gas/ にも配置する。
// appsscript.json も dist 直下と dist/gas/ にコピーする。
//
// 注意: GAS プロジェクトには実行に必要なファイルだけを置きたいので、
// 拡張子ホワイトリスト方式でコピーする。以前は全ファイルをコピーしていたため、
// TypeScript のビルドキャッシュ（*.tsbuildinfo, 103KB）が本番へ混入していた。

import {
  existsSync,
  mkdirSync,
  readdirSync,
  lstatSync,
  copyFileSync,
  rmSync,
  readFileSync,
  statSync,
} from "fs";
import { resolve, join, dirname, relative } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const distDir = join(rootDir, "dist");
// GAS specific output directory (for clasp rootDir)
const gasDistDir = join(distDir, "gas");

/** サーバのビルド成果物（単一バンドル） */
const SERVER_DIST = join(rootDir, "packages", "infrastructures", "dist");
/** デプロイ対象のクライアント（唯一の GAS Web アプリ） */
const CLIENT_DIST = join(rootDir, "apps", "app-scheduler", "dist");

/** dist に置いてよい拡張子（ホワイトリスト） */
const ALLOWED_EXTENSIONS = new Set([".js", ".html", ".json", ".css"]);

/** GAS では実行できない ES モジュール出力かどうかを判定する。 */
function isMaybeEsm(fullPath, relPath) {
  if (!/\.(js|mjs|cjs)$/i.test(relPath)) return false;
  try {
    const content = readFileSync(fullPath, "utf8");
    // 行頭の import/export を検出する。GAS(V8) は ES モジュールを解釈できないため
    // これらが含まれるバンドルは配布しない。
    return /(^|\n)\s*(export\s+|import\s+|export\s*\*)/m.test(content);
  } catch (e) {
    console.warn(`Warning: failed to read ${fullPath}: ${e.message}`);
    return false;
  }
}

function walkFiles(dir, callback, baseDir = dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (lstatSync(fullPath).isDirectory()) {
      walkFiles(fullPath, callback, baseDir);
    } else {
      callback(fullPath, relative(baseDir, fullPath));
    }
  }
}

/** 1 ディレクトリの dist を dist/ と dist/gas/ へフラットコピーする。 */
function collectDist(srcDistDir, label) {
  if (!existsSync(srcDistDir)) {
    console.warn(`Warning: ${label} の dist が存在しません: ${srcDistDir}`);
    return 0;
  }

  let copied = 0;
  walkFiles(srcDistDir, (fullPath, relPath) => {
    // 型定義は GAS では不要
    if (/\.d\.ts$/i.test(relPath)) return;
    const ext = relPath.slice(relPath.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      console.log(`Skipping (not whitelisted): ${label}/${relPath}`);
      return;
    }
    // Apps Script が解釈できない ES モジュール出力は配布しない
    if (isMaybeEsm(fullPath, relPath)) {
      console.log(`Skipping ESM file: ${label}/${relPath}`);
      return;
    }

    const fileName = relPath.split(/[\\/]/).pop();
    copyFileSync(fullPath, join(distDir, fileName));
    copyFileSync(fullPath, join(gasDistDir, fileName));
    copied++;
    console.log(
      `  ${label}: ${fileName} (${statSync(fullPath).size} bytes)`
    );
  });
  return copied;
}

// distディレクトリを初期化
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}
mkdirSync(gasDistDir, { recursive: true });

const serverCount = collectDist(SERVER_DIST, "server");
const clientCount = collectDist(CLIENT_DIST, "app-scheduler");

// appsscript.jsonをdist直下とdist/gasにコピー
const appsscriptJson = join(rootDir, "appsscript.json");
if (existsSync(appsscriptJson)) {
  copyFileSync(appsscriptJson, join(distDir, "appsscript.json"));
  copyFileSync(appsscriptJson, join(gasDistDir, "appsscript.json"));
}

console.log(
  `dist直下へフラットに成果物を集約しました。 (server: ${serverCount} files, client: ${clientCount} files)`
);