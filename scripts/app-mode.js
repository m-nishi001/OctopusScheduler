/**
 * アプリの動作モード(development / production)を設定ファイルから読む共有ローダ。
 *
 * モードはリポジトリ直下の `app-mode.config.json` を書き換えて再ビルド・デプロイする
 * ことでのみ切り替える(実行時設定は使わない)。ファイルが無い/値が不正な場合は
 * 暗黙のデフォルトを持たずエラーにする。
 *
 * 次から使う:
 *   - apps/app-scheduler/vite.config.ts (クライアント)
 *   - packages/infrastructures/esbuild*.config.js (GAS / Cloudflare サーバ)
 * いずれも `define: { __APP_MODE__: "\"development\"" }` の形で注入する。
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

export const APP_MODES = ["development", "production"];

const CONFIG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "app-mode.config.json",
);

/** JSON文字列からモードを取り出す。不正なら例外。 */
export function parseAppMode(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("app-mode.config.json is not valid JSON");
  }
  if (!APP_MODES.includes(json?.mode)) {
    throw new Error(
      `app-mode.config.json: "mode" must be one of ${APP_MODES.join(", ")} (got ${JSON.stringify(json?.mode)})`,
    );
  }
  return json.mode;
}

export function loadAppMode(path = CONFIG_PATH) {
  return parseAppMode(readFileSync(path, "utf8"));
}

/** esbuild / vite の `define` にそのまま渡せる形。 */
export function appModeDefine(path = CONFIG_PATH) {
  return { __APP_MODE__: JSON.stringify(loadAppMode(path)) };
}
