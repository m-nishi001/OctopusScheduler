import { ErrorResponse } from "./error-response";
import { SuccessResponse } from "./success-response";

/**
 * @typedef {SuccessResponse<T> | ErrorResponse} ApiResponse
 * @description GASサービスの呼び出し結果を示す共通の応答型。
 * 成功時は SuccessResponse、エラー時は ErrorResponse となります。
 * @template T - 成功時に返されるデータの型。
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;