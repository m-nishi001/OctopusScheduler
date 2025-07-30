import { ErrorResponse } from "./error-response";
import { SuccessResponse } from "./success-response";

/**
 * @typedef {SuccessResponse | ErrorResponse} ApiResponse
 * @description GASサービスの呼び出し結果を示す共通の応答型。
 * 成功時は SuccessResponse、エラー時は ErrorResponse となります。
 */
export type ApiResponse = SuccessResponse | ErrorResponse;