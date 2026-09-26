/**
 * Cloudflare Worker のビルド設定。
 *
 * GAS版と異なり、`google.script.run` 用のグローバル関数shim(banner/footer)は
 * 不要。Workersは通常のESモジュールとして`export default { fetch }`を実行できる。
 */
import { build } from "esbuild";

build({
  entryPoints: ["src/cloudflare/index.ts"],
  bundle: true,
  outfile: "dist/cloudflare/worker.js",
  target: "es2022",
  format: "esm",
  platform: "browser",
  conditions: ["workerd", "browser"],
  // nodejs_compat(wrangler.toml)がランタイム側で提供するため、バンドルに含めない。
  external: ["node:async_hooks"],
}).catch(() => process.exit(1));
