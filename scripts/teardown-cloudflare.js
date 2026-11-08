/**
 * Cloudflare に作ったリソースの削除。`setup-cloudflare.js` の逆。scripts/cf-env.js(`npm run <env>:down`)から呼ばれるライブラリ。
 *
 *   1. Worker を削除する(Durable Object・Worker の secret も一緒に消える)
 *   2. D1 データベースを削除する
 *   3. R2 バケットを削除する(空でなければ AWS CLI の profile r2 で S3 互換 API から空にして再試行する。
 *      AWS CLI が使えず空にできないときは手順を表示する)
 *   4. ローカルの設定ファイル(wrangler.<env>.toml)を削除する(次回デプロイで新しい ID で生成し直す)
 *
 * 管理者アカウントやセッションは R2 に入っているため、バケットを消すと失われる。
 */

/** 削除する対象の一覧(確認表示とテストに使う)。 */
export function planTargets({ workerName, d1Name, bucket, keepBucket }) {
  const targets = [`Worker: ${workerName}(Durable Object と secret を含む)`, `D1: ${d1Name}`];
  targets.push(keepBucket ? `R2: ${bucket}(残す)` : `R2: ${bucket}(管理者アカウント・セッションも消える)`);
  return targets;
}

/** 失敗を握りつぶさず、結果の文言にして続行する(存在しないリソースは「なし」扱い)。 */
function attempt(label, fn, log) {
  try {
    fn();
    log(`✔ ${label}`);
    return { ok: true };
  } catch (error) {
    const text = `${error.stderr ?? ""}${error.stdout ?? ""}${error.message ?? ""}`;
    if (/not found|couldn't find|does not exist|no such|10007|10006|7404/i.test(text)) {
      log(`- ${label}(既に存在しません)`);
      return { ok: true, missing: true };
    }
    log(`✘ ${label}: ${text.split("\n").find((l) => l.trim()) ?? "失敗"}`);
    return { ok: false, text };
  }
}

function isBucketNotEmpty(text) {
  return /not empty|non-empty|10008|must be empty/i.test(text ?? "");
}

/**
 * 削除の本体。run(args) は wrangler を実行する関数、emptyBucket(bucket) は R2 を S3 互換 API で空にする関数
 * (どちらもテストで差し替える。emptyBucket は省略可)。
 * 戻り値: { failed: string[], bucketNotEmpty: boolean }
 */
export function teardown({ run, emptyBucket, workerName, d1Name, bucket, keepBucket, removeLocalToml, log }) {
  const failed = [];
  let bucketNotEmpty = false;

  if (!attempt("Worker を削除", () => run(["delete", "--name", workerName, "--force"]), log).ok) failed.push("worker");
  if (!attempt("D1 を削除", () => run(["d1", "delete", d1Name, "--skip-confirmation"]), log).ok) failed.push("d1");

  if (!keepBucket) {
    const deleteBucket = () => attempt("R2 バケットを削除", () => run(["r2", "bucket", "delete", bucket]), log);
    let r = deleteBucket();
    // 空でなければ S3 互換 API で空にして、もう一度削除する(emptyBucket が無い・失敗したときは従来どおり案内する)
    if (!r.ok && emptyBucket && isBucketNotEmpty(r.text)) {
      if (attempt("R2 バケットの中身を削除(S3 互換 API)", () => emptyBucket(bucket), log).ok) r = deleteBucket();
    }
    if (!r.ok) {
      failed.push("r2");
      bucketNotEmpty = isBucketNotEmpty(r.text);
    }
  }

  if (failed.length === 0) removeLocalToml();
  return { failed, bucketNotEmpty };
}
