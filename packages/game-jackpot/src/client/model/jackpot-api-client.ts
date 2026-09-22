/**
 * jackpotGame_* エンドポイントを型安全に呼び出すための薄いヘルパー。
 */
import type { ApiCallOptions, IApiClient } from "@octopus/infrastructures/interfaces";
import { JACKPOT_GAME_PREFIX } from "../../server/jackpot-api-contract";
import type { JackpotGameEndpointName } from "../../server/jackpot-api-contract";

export function callJackpotGame<T = unknown>(
  apiClient: IApiClient,
  name: JackpotGameEndpointName,
  args?: unknown,
  options?: ApiCallOptions
): Promise<T> {
  return apiClient.call<T>(`${JACKPOT_GAME_PREFIX}_${name}`, args, options);
}
