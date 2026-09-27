/**
 * 同期処理などで、バックエンドに対して同時に投げてよいリクエスト数を
 * 抽象化するポート。
 *
 * GAS は `google.script.run` の同時実行数に厳しい制限があり、超過すると
 * `GasFunctionService.isParallelLimitError` が検出する
 * "Service invoked too many times in a short time" エラーになるため、
 * 同期対象の種別(kind)ごとに小さい上限を返す実装が必要になる。一方
 * Cloudflare Workers への通信はブラウザの `fetch` ベースで同様の制限が
 * ないため、高い上限を返せる。呼び出す側(sync-engine の SyncRunner)は
 * このインターフェースだけに依存する。
 */
export interface IConcurrencyPolicy {
  /**
   * 指定した kind (同期対象の種別、例: "asset" / "members") について、
   * 同時に実行してよい push/pull リクエストの最大数を返す。
   */
  maxConcurrency(kind: string): number;
}

export const IConcurrencyPolicyToken = Symbol("IConcurrencyPolicy");
