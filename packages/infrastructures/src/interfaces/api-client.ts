/**
 * クライアントとサーバーの間の RPC 呼び出しを抽象化するポート。
 *
 * GAS では `google.script.run` を、将来 Cloudflare では `fetch` を使うが、
 * どちらの実装も同じインターフェースの背後に隠れる。呼び出す側
 * (各機能パッケージのリポジトリ)はこのインターフェースだけに依存する。
 */

import type { ApiResponse } from "@octopus/client-common/google-apps-script/gas-script-service";

/** RPC 呼び出しの共通レスポンス。定義は(より下位の)client-common にあり、ここから再公開する。 */
export type { ApiResponse };

export interface ApiCallOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * 呼び出しが回数の上限で断られた(HTTP 429)。`retryAfterMs` はサーバーが示す待ち時間(`Retry-After`)。
 * API クライアントは、ここで待たずにそのまま投げる(すぐ再試行しても断られるだけなので、
 * 並列に送る側が待ち時間を見て、全体の速度を落とす)。
 */
export class RateLimitedError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

/**
 * ファイル(画像・音声・動画)の送受信先。どのモジュールのファイル置き場かを指す。
 * 送り方は API クライアントが決める(Cloudflare はバイナリの `/blobs/<module>/<hash>`、GAS は base64 のデータURLで下の GAS 関数を呼ぶ)。
 */
export interface BlobRoute {
  /** 保存先のモジュール名(`StorageModule` の値)。Cloudflare の `/blobs/<module>/<hash>` の `<module>`。 */
  module: string;
  /** GAS の関数名(`<接頭辞>_<エンドポイント>`)。ファイルを送る/取る。GAS は文字列しか送れないので base64 のデータURLで受け渡す。 */
  gasPut: string;
  gasGet: string;
}

export interface IApiClient {
  /**
   * `functionName` で指定したサーバー側エンドポイントを呼び出す。
   * GAS実装では `google.script.run` のトップレベル関数名として使われる。
   */
  call<T = unknown>(
    functionName: string,
    args?: unknown,
    options?: ApiCallOptions
  ): Promise<T>;

  /** ファイルをサーバーに上げる。同じハッシュなら同じ内容なので、何度送っても結果は同じ。 */
  putBlob(route: BlobRoute, hash: string, blob: Blob, options?: ApiCallOptions): Promise<void>;

  /** ファイルをサーバーから取る。サーバーに無ければ null。 */
  getBlob(route: BlobRoute, hash: string, options?: ApiCallOptions): Promise<Blob | null>;
}

export const IApiClientToken = Symbol("IApiClient");
