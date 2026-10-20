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
