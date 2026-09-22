/**
 * octopusScheduler_* エンドポイントを型安全に呼び出すための薄いヘルパー。
 */
import type { ApiCallOptions, IApiClient } from "@octopus/infrastructures/interfaces";
import { OCTOPUS_SCHEDULER_PREFIX } from "../../server/scheduler-api-contract";
import type { OctopusSchedulerEndpointName } from "../../server/scheduler-api-contract";

export function callOctopusScheduler<T = unknown>(
  apiClient: IApiClient,
  name: OctopusSchedulerEndpointName,
  args?: unknown,
  options?: ApiCallOptions
): Promise<T> {
  return apiClient.call<T>(`${OCTOPUS_SCHEDULER_PREFIX}_${name}`, args, options);
}
