/**
 * @file gas-service.ts
 * @description Google Apps Script (GAS) 環境で動作するサービス向けの共通インターフェースを定義します。
 * このインターフェースを実装するクラスは、特定のGASサービス機能を提供し、
 * invoke メソッドを通じてその機能が実行されます。
 */

/**
 * @typedef {object} SuccessResponse
 * @property {'success'} status - 処理が成功したことを示します。
 * @property {T} data - 成功時に返されるデータ。
 * @template T
 */
export class SuccessResponse<T> {
    status: string = 'success';
    data: T;

    constructor(data: T) {
        this.data = data;
    }
};

/**
 * @typedef {object} ErrorResponse
 * @property {'error'} status - 処理中にエラーが発生したことを示します。
 * @property {string} message - エラーの詳細なメッセージ。
 */
export class ErrorResponse {
    status: string = 'error';
    message: string;

    constructor(message: string) {
        this.message = message;
    }
};

/**
 * @typedef {SuccessResponse<T> | ErrorResponse} ApiResponse
 * @description GASサービスの呼び出し結果を示す共通の応答型。
 * 成功時は SuccessResponse、エラー時は ErrorResponse となります。
 * @template T - 成功時に返されるデータの型。
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * @interface IGasService
 * @description Google Apps Script (GAS) サービスが実装すべき共通のインターフェース。
 * 各GASサービスは、特定の「関数名」と、その関数を実行する「invoke」メソッドを持ちます。
 */
export interface GasService {
    /**
     * @property {string} functionName
     * @description このGASサービスが提供する機能を示す一意の関数名。
     * 例えば、"getSpreadsheetData", "sendEmail" など、
     * Google Apps Script 環境で実行される特定の処理を識別します。
     */
    readonly serviceName: string;

    readonly functions: Record<string, (...args: any) => ApiResponse<any>>
}