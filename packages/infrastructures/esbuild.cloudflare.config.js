/**
 * Cloudflare Worker のビルド設定。
 *
 * GAS版と異なり、`google.script.run` 用のグローバル関数shim(banner/footer)は
 * 不要。Workersは通常のESモジュールとして`export default { fetch }`を実行できる。
 */
import { build } from "esbuild";
import { appModeDefine } from "../../scripts/app-mode.js";
import { loadGasContract } from "../../scripts/gas-contract.js";

// 各 endpoints.ts は `_<prefix>_<name> = async (...) => ...` と共有のハンドラ変数へ
// 代入する(GAS の banner が `let` で宣言するのと同じ)。ESM は strict のため、宣言が無いと
// 読み込み時に ReferenceError になる。
const { internalNames, unprefixed, ownerOf } = loadGasContract();
const handlerVars = [...internalNames, ...unprefixed.map((name) => `_${ownerOf(name)}_${name}`)];

build({
  entryPoints: ["src/cloudflare/index.ts"],
  bundle: true,
  outfile: "dist/cloudflare/worker.js",
  target: "es2022",
  format: "esm",
  platform: "browser",
  conditions: ["workerd", "browser"],
  define: appModeDefine(),
  banner: { js: `let ${handlerVars.join(", ")};` },
  // nodejs_compat(wrangler.toml)がランタイム側で提供するため、バンドルに含めない。
  external: ["node:async_hooks"],
}).catch(() => process.exit(1));
