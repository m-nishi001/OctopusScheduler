/**
 * quizGame_* エンドポイントを型安全に呼び出すための薄いヘルパー。
 *
 * IApiClient.call() 自体は(GAS/Cloudflareどちらでも使えるよう)functionName を
 * 単純な string としているため、ここでエンドポイント名を
 * `QuizGameEndpointName` に制約し、タイプミスや存在しないエンドポイント呼び出しを
 * コンパイル時に検出できるようにする。
 */
import type { ApiCallOptions, IApiClient } from "@octopus/infrastructures/interfaces";
import { QUIZ_GAME_PREFIX } from "../../server/quiz-api-contract";
import type { QuizGameEndpointName } from "../../server/quiz-api-contract";

export function callQuizGame<T = unknown>(
  apiClient: IApiClient,
  name: QuizGameEndpointName,
  args?: unknown,
  options?: ApiCallOptions
): Promise<T> {
  return apiClient.call<T>(`${QUIZ_GAME_PREFIX}_${name}`, args, options);
}
