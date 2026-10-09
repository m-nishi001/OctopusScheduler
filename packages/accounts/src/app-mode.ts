/**
 * ビルド時に app-mode.config.json から埋め込まれた動作モード(scripts/app-mode.js が
 * vite / esbuild の `define` で `__APP_MODE__` を置換する)。サーバーとクライアントの
 * 両方から使うため、このファイルは依存を持たない。
 */
declare const __APP_MODE__: "development" | "production";

export function isProductionMode(): boolean {
  return __APP_MODE__ === "production";
}
