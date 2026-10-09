import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { sharedPlugins } from "../../vite.shared";
import { appModeDefine } from "../../scripts/app-mode.js";

/**
 * `--mode cloudflare` でビルドすると、`@octopus/infrastructures/platform-api-client`
 * の解決先が `cloudflare-api-client.ts` に切り替わり(package.jsonのexports
 * conditions)、出力先も `dist/cloudflare` になる。それ以外(既定)は従来通りの
 * GASビルド(`dist/gas`)。
 */
export default defineConfig(({ mode }) => ({
  plugins: [...sharedPlugins, viteSingleFile()],
  // app-mode.config.json の動作モード(development / production)をビルド時に埋め込む。
  define: appModeDefine(),
  resolve: {
    conditions: mode === "cloudflare" ? ["cloudflare"] : [],
  },
  build: {
    target: "es2020",
    outDir: mode === "cloudflare" ? "dist/cloudflare" : "dist/gas",
  },
}));
