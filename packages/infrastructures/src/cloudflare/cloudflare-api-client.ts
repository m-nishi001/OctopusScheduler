/**
 * IApiClient の Cloudflare 実装(ブラウザ側)。
 *
 * `/rpc` エンドポイントへの fetch 呼び出しに委譲する。タイムアウト・リトライの
 * 考え方は GasApiClient(GasFunctionService)に合わせるが、GAS固有の
 * 「同時実行数超過」エラーの特別扱いは対象外(Cloudflareにその制約はないため)。
 */
import { injectable } from "tsyringe";
import type { ApiCallOptions, ApiResponse, IApiClient } from "../interfaces/api-client";

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@injectable()
export class CloudflareApiClient implements IApiClient {
  async call<T = unknown>(
    functionName: string,
    args?: unknown,
    options?: ApiCallOptions
  ): Promise<T> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
    const retries = options?.retries ?? DEFAULT_RETRIES;
    const retryDelay = options?.retryDelay ?? DEFAULT_RETRY_DELAY_MS;

    let attempts = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempts++;
      try {
        const response = await this.callOnce<T>(functionName, args, timeout);
        if (response.status === "success") return response.data;
        if (attempts <= retries) {
          await sleep(retryDelay);
          continue;
        }
        throw new Error(response.message);
      } catch (error) {
        if (attempts <= retries) {
          await sleep(retryDelay);
          continue;
        }
        throw error;
      }
    }
  }

  private async callOnce<T>(
    functionName: string,
    args: unknown,
    timeoutMs: number
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch("/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: functionName, args }),
        signal: controller.signal,
      });
      const text = await res.text();
      try {
        return JSON.parse(text) as ApiResponse<T>;
      } catch (e) {
        return {
          status: "error",
          message: `応答のパースに失敗しました: ${(e as Error).message}. 応答: ${text}`,
        };
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error(
          `Cloudflare関数 '${functionName}' の呼び出しが ${timeoutMs}ms でタイムアウトしました。`
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
