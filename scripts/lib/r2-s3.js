/**
 * R2 バケットを S3 互換 API(AWS CLI)で空にする。
 *
 * wrangler には R2 のオブジェクト一覧・一括削除が無く、空でないバケットは削除できない。R2 は S3 互換なので、
 * AWS CLI の profile(既定 `r2`。キーとエンドポイントは `~/.aws` にあり、リポジトリには置かない)で空にする。
 * 設定方法は docs/dev-environment.md。
 */
import { execFileSync } from "node:child_process";

export const DEFAULT_PROFILE = "r2";

/** 使う AWS CLI の profile 名(環境変数 R2_AWS_PROFILE で変えられる)。 */
export function awsProfile(env = process.env) {
  return env.R2_AWS_PROFILE || DEFAULT_PROFILE;
}

/** バケットの中身をすべて削除する aws の引数。 */
export function emptyBucketArgs(bucket, profile = DEFAULT_PROFILE) {
  return ["s3", "rm", `s3://${bucket}`, "--recursive", "--profile", profile];
}

/** aws を同期実行して標準出力を返す。aws が無いときは、導入を促す例外にする。 */
export function runAws(args, options = {}) {
  try {
    return execFileSync("aws", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  } catch (error) {
    if (error.code === "ENOENT") throw new Error("aws コマンドが見つかりません(AWS CLI v2 を導入してください。docs/dev-environment.md)");
    throw error;
  }
}

/** バケットを空にする。呼び出し側が差し替えられるよう、実行関数は引数で受ける。 */
export function emptyBucket(bucket, { run = runAws, profile = awsProfile() } = {}) {
  return run(emptyBucketArgs(bucket, profile));
}
