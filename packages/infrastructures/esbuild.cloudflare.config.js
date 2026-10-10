/**
 * Cloudflare Worker のビルド設定。
 *
 * GAS版と異なり、`google.script.run` 用のグローバル関数shim(footer)は不要。
 * Workersは通常のESモジュールとして`export default { fetch }`を実行できる。
 * ただし内部ハンドラ変数の `let` 宣言(banner)だけは必要(下記参照)。
 */
import { build } from "esbuild";
import { loadGasContract } from "../../scripts/gas-contract.js";

// 各機能パッケージの endpoints.ts は `_<prefix>_<name> = async (...) => {...}` と
// 宣言なしで代入する(GAS版は banner の `let` でグローバル宣言している)。
// ESM は strict mode のため、宣言が無いと起動時に ReferenceError になる。
const { handlerVariableNames } = loadGasContract();

build({
  entryPoints: ["src/cloudflare/index.ts"],
  bundle: true,
  outfile: "dist/cloudflare/worker.js",
  target: "es2022",
  format: "esm",
  platform: "browser",
  conditions: ["workerd", "browser"],
  banner: { js: `\nlet ${handlerVariableNames.join(", ")};\n` },
  // nodejs_compat(wrangler.toml)がランタイム側で提供するため、バンドルに含めない。
  external: ["node:async_hooks"],
}).catch(() => process.exit(1));
