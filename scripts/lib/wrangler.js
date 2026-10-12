/**
 * wrangler の呼び出し口(スクリプト共通)。
 *
 * `npx -y wrangler@4` は呼ぶたびにパッケージ解決から始まり遅い。ルートの devDependency に wrangler 4 系が
 * 入っているので、そのバイナリを node で直接起動する。解決できないとき(単体で配布された場合など)だけ npx に戻す。
 */
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

/** [実行ファイル, 先頭引数] を返す。wrangler が見つかれば `node <wrangler.js>`、無ければ `npx -y wrangler@4`。 */
export function wranglerCommand(resolve = (id) => require.resolve(id)) {
  try {
    return [process.execPath, [resolve("wrangler/bin/wrangler.js")]];
  } catch {
    return ["npx", ["-y", "wrangler@4"]];
  }
}

/** wrangler を同期実行して標準出力を返す。 */
export function runWrangler(args, options = {}) {
  const [file, prefix] = wranglerCommand();
  return execFileSync(file, [...prefix, ...args], { encoding: "utf8", ...options });
}

/** wrangler を非同期実行して標準出力を返す(独立した処理を並列に流すため)。失敗時は stdout/stderr 付きの例外。 */
export async function runWranglerAsync(args, options = {}) {
  const [file, prefix] = wranglerCommand();
  const { stdout } = await execFileAsync(file, [...prefix, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  return stdout;
}
