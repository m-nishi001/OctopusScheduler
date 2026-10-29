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
}

export const IApiClientToken = Symbol("IApiClient");
