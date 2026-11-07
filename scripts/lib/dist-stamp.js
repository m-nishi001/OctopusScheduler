// dist が「現在のソースのビルド結果か」を確かめるための刻印(stamp)。
//
// `git pull` は gitignore 済みの dist/ を作り直さないので、古い dist を検証環境へデプロイしてしまう事故が起きる。
// ビルドの最後に「そのときのソースの指紋」を dist/cloudflare/build-info.json へ書き、
// デプロイ/起動の前に現在のソースの指紋と比べる。
//
// 指紋 = HEAD の sha + `git diff HEAD`(追跡ファイルの未コミット変更)の sha256。
// 注意: 未追跡ファイルは指紋に含めない(新規ファイルだけの追加は検知できない。git add すれば検知される)。
// git・fs は引数で注入できるので、実リポジトリなしでテストできる。
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** 刻印の置き場所。Worker の公開アセット(assets/)に混ざらないよう worker.js の隣に置く。 */
export const STAMP_RELATIVE_PATH = "cloudflare/build-info.json";

/** 実際の git を呼ぶ既定の run。 */
export function gitRun(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

/** @param {{ run: (args: string[]) => string }} deps */
export function computeSourceFingerprint({ run }) {
  const sha = run(["rev-parse", "HEAD"]).trim();
  const diff = run(["diff", "HEAD"]);
  const diffHash = diff ? createHash("sha256").update(diff).digest("hex") : "";
  return { sha, diffHash };
}

export function writeDistStamp(distDir, fingerprint, { mkdir = mkdirSync, write = writeFileSync } = {}) {
  const path = join(distDir, STAMP_RELATIVE_PATH);
  mkdir(join(distDir, "cloudflare"), { recursive: true });
  write(path, `${JSON.stringify({ ...fingerprint, builtAt: new Date().toISOString() }, null, 2)}\n`);
  return path;
}

/** 刻印を読む。無い/壊れていれば null。 */
export function readDistStamp(distDir, { exists = existsSync, read = readFileSync } = {}) {
  const path = join(distDir, STAMP_RELATIVE_PATH);
  if (!exists(path)) return null;
  try {
    const stamp = JSON.parse(read(path, "utf8"));
    return typeof stamp?.sha === "string" ? stamp : null;
  } catch {
    return null;
  }
}

const short = (sha) => sha.slice(0, 8);
const HOW_TO_FIX = "依存が変わっていれば npm ci を実行してから、npm run build を実行してください。";

/** 一致していれば null、そうでなければ日本語のエラーメッセージを返す(純粋関数)。 */
export function checkDistFresh({ stamp, fingerprint }) {
  if (!stamp) {
    return `dist のビルド記録(dist/${STAMP_RELATIVE_PATH})がありません。${HOW_TO_FIX}`;
  }
  if (stamp.sha !== fingerprint.sha) {
    return `dist は ${short(stamp.sha)} からビルドされていますが、現在のソースは ${short(fingerprint.sha)} です。${HOW_TO_FIX}`;
  }
  if ((stamp.diffHash ?? "") !== fingerprint.diffHash) {
    const was = stamp.diffHash ? "未コミットの変更つき" : "変更なし";
    const now = fingerprint.diffHash ? "未コミットの変更つき(dirty)" : "変更なし";
    return `dist は ${short(stamp.sha)} の${was}でビルドされていますが、現在のソースは ${short(fingerprint.sha)} の${now}です。${HOW_TO_FIX}`;
  }
  return null;
}

/** dist が現在のソースのビルドでなければ throw する。 */
export function assertDistFresh({ distDir, fingerprint, readStamp = readDistStamp }) {
  const message = checkDistFresh({ stamp: readStamp(distDir), fingerprint });
  if (message) throw new Error(message);
}

/** 実 git で現在のソースの指紋を取る。 */
export function currentFingerprint(root) {
  return computeSourceFingerprint({ run: (args) => gitRun(args, root) });
}
