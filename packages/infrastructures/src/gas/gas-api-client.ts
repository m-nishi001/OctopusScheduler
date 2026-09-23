/**
 * IApiClient の GAS 実装。
 *
 * 実際の `google.script.run` 呼び出しは client-common の既存 `GasFunctionService`
 * (リトライ・タイムアウト機構を持つ)にそのまま委譲する薄いラッパー。
 */
import { injectable } from "tsyringe";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { GasFunctionService } from "@octopus/client-common/google-apps-script/gas-script-service";
import type { IApiClient, ApiCallOptions } from "../interfaces/api-client";

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
    return service.call<T>(args);
  }
}
