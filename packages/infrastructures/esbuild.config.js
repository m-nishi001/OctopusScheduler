/**
 * GAS サーバのビルド設定。
 *
 * GAS の `google.script.run` はトップレベル関数しか呼べないため、
 * バンドル(IIFE)の外側に公開関数を定義する必要がある。
 * その banner / footer を各機能パッケージが公開するエンドポイント一覧から
 * **コード生成**する(scripts/gas-contract.js)。
 */
import { build } from "esbuild";
import { loadGasContract } from "../../scripts/gas-contract.js";

const { internalNames, unprefixed, ownerOf } = loadGasContract();

/** 接頭辞付き関数: `function <prefix>_<name>(...args)` から内部ハンドラへ委譲 */
const prefixedFooter = internalNames
  .map((n) => `function ${n.slice(1)}(...args) { return ${n}.apply(this, args); }`)
  .join("\n");

/** 接頭辞なし関数: GAS のエントリポイント(doGet など) */
const unprefixedFooter = unprefixed
  .map((name) => `function ${name}(e) { return _${ownerOf(name)}_${name}(e); }`)
  .join("\n");

build({
  entryPoints: ["src/gas/index.ts"],
  bundle: true,
  outfile: "dist/server.js",
  target: "es2020",
  format: "iife",
  platform: "browser",
  banner: { js: `\nlet ${internalNames.join(", ")};\n` },
  footer: { js: `\n${prefixedFooter}\n${unprefixedFooter}\n` },
}).catch(() => process.exit(1));
