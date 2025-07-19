/**
 * @file IGasService.ts
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
export type SuccessResponse<T> = {
    status: 'success';
    data: T;
};

/**
 * @typedef {object} ErrorResponse
 * @property {'error'} status - 処理中にエラーが発生したことを示します。
 * @property {string} message - エラーの詳細なメッセージ。
 */
export type ErrorResponse = {
    status: 'error';
    message: string;
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
export interface IGasService {
    /**
     * @property {string} functionName
     * @description このGASサービスが提供する機能を示す一意の関数名。
     * 例えば、"getSpreadsheetData", "sendEmail" など、
     * Google Apps Script 環境で実行される特定の処理を識別します。
     */
    readonly functionName: string;

    /**
     * @method invoke
     * @description このGASサービスに定義された機能を実行します。
     * Google Apps Script 環境での特定の処理を実行する際に使用します。
     * @param {any[]} args - 実行する機能に渡す引数の配列。引数の型や数は、実装される機能によって異なります。
     * @returns {Promise<ApiResponse<any>>} - 実行結果を解決するPromise。
     * 成功時は `SuccessResponse` (dataに任意の型を含む)、エラー時は `ErrorResponse` を返します。
     */
    invoke(...args: any[]): Promise<ApiResponse<any>>;
}