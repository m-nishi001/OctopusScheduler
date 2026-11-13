/**
 * IApiClient の Cloudflare 実装(ブラウザ側)。
 *
 * `/rpc` エンドポイントへの fetch 呼び出しに委譲する。タイムアウト・リトライの
 * 考え方は GasApiClient(GasFunctionService)に合わせるが、GAS固有の
 * 「同時実行数超過」エラーの特別扱いは対象外(Cloudflareにその制約はないため)。
 */
import { injectable } from "tsyringe";
import { getSessionToken } from "@octopus/client-common/auth/session-token-store";
import { RateLimitedError } from "../interfaces/api-client";
import type { ApiCallOptions, ApiResponse, BlobRoute, IApiClient } from "../interfaces/api-client";
import { wrapWithAuth } from "../interfaces/auth-envelope";

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
/** `Retry-After` が無い・読めないときの待ち時間(秒)。 */
const DEFAULT_RATE_LIMIT_WAIT_S = 60;
/** ファイル(最大30MB)の送受信のタイムアウト。JSON の呼び出しより長い。 */
const DEFAULT_BLOB_TIMEOUT_MS = 120000;

/** リトライしても結果が変わらないエラー(認証エラー等)。 */
class NonRetryableError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `IApiClient` の Cloudflare 実装。`/rpc` への fetch で呼び出し、タイムアウトと再試行を持つ。`retryable: false` の応答(認証エラー・業務エラー)は再試行しない。
 */
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
        if (response.retryable === false) throw new NonRetryableError(response.message);
        if (attempts <= retries) {
          await sleep(retryDelay);
          continue;
        }
        throw new Error(response.message);
      } catch (error) {
        if (error instanceof RateLimitedError) throw error;
        if (!(error instanceof NonRetryableError) && attempts <= retries) {
          await sleep(retryDelay);
          continue;
        }
        throw error;
      }
    }
  }

  /** ファイルをバイナリのまま `PUT /blobs/<module>/<hash>` で上げる。 */
  async putBlob(route: BlobRoute, hash: string, blob: Blob, options?: ApiCallOptions): Promise<void> {
    await this.blobRequest(route, hash, options, (url, signal) =>
      fetch(url, {
        method: "PUT",
        headers: { ...this.authHeader(), "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
        signal,
      })
    );
  }

  /** ファイルをバイナリのまま `GET /blobs/<module>/<hash>` で取る。サーバーに無ければ null。同じハッシュはブラウザのキャッシュから返る。 */
  async getBlob(route: BlobRoute, hash: string, options?: ApiCallOptions): Promise<Blob | null> {
    const res = await this.blobRequest(route, hash, options, (url, signal) =>
      fetch(url, { method: "GET", headers: this.authHeader(), signal })
    );
    if (res.status === 404) return null;
    return new Blob([await res.arrayBuffer()], { type: res.headers.get("Content-Type") ?? "" });
  }

  private authHeader(): Record<string, string> {
    const token = getSessionToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** `/blobs` への1回の要求。通信の失敗と 5xx は再試行し、429・その他の失敗(認証・ハッシュ不一致など)は再試行せず投げる。404 は呼び出し側に返す。 */
  private async blobRequest(
    route: BlobRoute,
    hash: string,
    options: ApiCallOptions | undefined,
    send: (url: string, signal: AbortSignal) => Promise<Response>
  ): Promise<Response> {
    const timeout = options?.timeout ?? DEFAULT_BLOB_TIMEOUT_MS;
    const retries = options?.retries ?? DEFAULT_RETRIES;
    const retryDelay = options?.retryDelay ?? DEFAULT_RETRY_DELAY_MS;
    const url = `/blobs/${encodeURIComponent(route.module)}/${encodeURIComponent(hash)}`;
    for (let attempt = 1; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await send(url, controller.signal);
        if (res.ok || res.status === 404) return res;
        if (res.status === 429) {
          const seconds = Number(res.headers.get("Retry-After"));
          throw new RateLimitedError(
            "Too many requests",
            (Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RATE_LIMIT_WAIT_S) * 1000
          );
        }
        const message = `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
        if (res.status < 500) throw new NonRetryableError(message);
        throw new Error(message);
      } catch (error) {
        if (error instanceof RateLimitedError || error instanceof NonRetryableError || attempt > retries) {
          if ((error as Error).name === "AbortError") {
            throw new Error(`Cloudflare のファイル ${hash} の送受信が ${timeout}ms でタイムアウトしました。`);
          }
          throw error;
        }
        await sleep(retryDelay);
      } finally {
        clearTimeout(timer);
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
        body: JSON.stringify({ name: functionName, args: wrapWithAuth(getSessionToken(), args) }),
        signal: controller.signal,
      });
      if (res.status === 429) {
        const seconds = Number(res.headers.get("Retry-After"));
        throw new RateLimitedError(
          "Too many requests",
          (Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RATE_LIMIT_WAIT_S) * 1000
        );
      }
      const text = await res.text();
      // 失敗の理由(同期のログなど)で原因を辿れるよう、HTTPの失敗はステータスをメッセージの先頭に付ける
      const httpPrefix = res.ok ? "" : `HTTP ${res.status}: `;
      try {
        const parsed = JSON.parse(text) as ApiResponse<T>;
        if (parsed.status === "error" && httpPrefix) parsed.message = httpPrefix + parsed.message;
        return parsed;
      } catch (e) {
        return {
          status: "error",
          message: `${httpPrefix}応答のパースに失敗しました: ${(e as Error).message}. 応答: ${text}`,
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

/**
 * `@octopus/infrastructures/platform-api-client` 経由で解決される際の中立な名前。
 * GAS実装(gas-api-client.ts)も同名でexportし、呼び出し側はビルド対象
 * (GAS/Cloudflare)を意識せず同じ識別子で参照できるようにする。
 */
export { CloudflareApiClient as PlatformApiClient };
