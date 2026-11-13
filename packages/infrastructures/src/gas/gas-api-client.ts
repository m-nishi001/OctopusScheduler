/**
 * IApiClient の GAS 実装。
 *
 * 実際の `google.script.run` 呼び出しは client-common の既存 `GasFunctionService`
 * (リトライ・タイムアウト機構を持つ)にそのまま委譲する薄いラッパー。
 */
import { injectable } from "tsyringe";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { GasFunctionService } from "@octopus/client-common/google-apps-script/gas-script-service";
import { getSessionToken } from "@octopus/client-common/auth/session-token-store";
import { blobToDataUrl } from "@octopus/client-common/blob/blob-to-data-url";
import { dataUrlToBlob } from "@octopus/client-common/blob/data-url-to-blob";
import type { IApiClient, ApiCallOptions, BlobRoute } from "../interfaces/api-client";
import { wrapWithAuth } from "../interfaces/auth-envelope";

/** `IApiClient` の GAS 実装。`google.script.run` の呼び出しを、リトライ・タイムアウトを持つ `GasFunctionService` に任せる。 */
@injectable()
export class GasApiClient implements IApiClient {
  call<T = unknown>(
    functionName: string,
    args?: unknown,
    options?: ApiCallOptions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new GasFunctionService(functionName as any, options);
    return service.call<T>(wrapWithAuth(getSessionToken(), args));
  }

  /** GAS は文字列しか送れないので、ファイルは base64 のデータURLにして送る。 */
  async putBlob(route: BlobRoute, hash: string, blob: Blob, options?: ApiCallOptions): Promise<void> {
    await this.call(route.gasPut, { hash, dataUrl: await blobToDataUrl(blob) }, options);
  }

  async getBlob(route: BlobRoute, hash: string, options?: ApiCallOptions): Promise<Blob | null> {
    const { dataUrl } = await this.call<{ dataUrl: string | null }>(route.gasGet, { hash }, options);
    return dataUrl ? dataUrlToBlob(dataUrl) : null;
  }
}

/**
 * `@octopus/infrastructures/platform-api-client` 経由で解決される際の中立な名前。
 * Cloudflare実装(cloudflare-api-client.ts)も同名でexportし、呼び出し側は
 * ビルド対象(GAS/Cloudflare)を意識せず同じ識別子で参照できるようにする。
 */
export { GasApiClient as PlatformApiClient };
