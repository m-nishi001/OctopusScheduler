import type { GasFunction } from './gas-function';

declare namespace google {
    namespace script {
        interface Run {
            withSuccessHandler(handler: (value: any) => void): Run;
            withFailureHandler(handler: (error: Error) => void): Run;
            withUserObject(object: Object): Run;
            [functionName: string]: (...args: any[]) => void;
        }
        const run: Run;
    }
}

/**
 * @file Google Apps Script (GAS) 関数呼び出しを管理するサービス。
 * 単一および並列でのGAS関数呼び出し、タイムアウト処理、自動リトライ、
 * およびGAS関数からのJSONレスポンスのデシリアライズをサポートします。
 */

/**
 * @typedef {object} SuccessResponse
 * @property {'success'} status - 処理が成功したことを示します。
 * @property {T} data - 成功時に返されるデータ。
 * @template T
 */
export class SuccessResponse<T> {
    public readonly status: 'success' = 'success';
    public readonly data:T;
    constructor(data: T) {
        this.data = data;
    }
}

/**
 * @typedef {object} ErrorResponse
 * @property {'error'} status - 個々のGAS関数呼び出し試行中にエラーが発生したことを示します。
 * @property {string} message - エラーの詳細なメッセージ。
 */
export class ErrorResponse {
    public readonly status: 'error' = 'error';
    public readonly message: string;
    constructor(message: string) {
        this.message = message;
    }
}

/**
 * @typedef {object} FailedResponse
 * @property {'failed'} status - 処理がリトライ上限に達しても成功しなかったことを示します。
 * @property {string} message - 最終的な失敗メッセージ。
 */
export class FailedResponse {
    public readonly status: 'failed' = 'failed';
    public readonly message: string;
    constructor(message: string) {
        this.message = message;
    }
}

/**
 * GAS関数呼び出しの最終的な結果を表す型。
 * 成功または最終的な失敗のいずれか。
 * @template T 成功時のデータの型。
 */
export type FinalGasCallResult<T> = SuccessResponse<T> | FailedResponse;

/**
 * Google Apps Script関数を呼び出すためのサービス。
 * タイムアウト、リトライ、JSONレスポンスのデシリアライズをサポートします。
 */
export class GasFunctionService {

    /**
     * 単一のGAS関数を呼び出します。
     * タイムアウト、自動リトライ、JSONレスポンスのデシリアライズをサポートします。
     *
     * @template T サーバーサイド関数が成功時に返すデータの型。
     * @param {string} functionName 呼び出すサーバーサイド関数の名前。
     * @param {any[]} args サーバーサイド関数に渡す引数。
     * @param {GasFunctionOptions} [options] 呼び出しオプション（タイムアウト、リトライ回数、リトライ遅延）。
     * @returns {Promise<FinalGasCallResult<T>>} 最終的な呼び出し結果を含むPromise。
     */
    public async call<T>(gasFunction: GasFunction<T>): Promise<FinalGasCallResult<T>> {
        const gasFunctionName = gasFunction.functionName;
        const gasFunctionArgs = gasFunction.args;
        const timeout = gasFunction.options.getTimeout();
        const retries = gasFunction.options.getRetries();
        const retryDelay = gasFunction.options.getRetryDelay();

        let attempts = 0;
        while (attempts <= retries) {
            attempts++;
            try {
                // Promise.raceを使用してタイムアウトとGAS関数呼び出しを競合させる
                // executeGasFunctionはSuccessResponseまたはErrorResponseを返す
                // createTimeoutPromiseはErrorResponseを返す
                const result = await Promise.race([
                    this.executeGasFunction<T>(gasFunctionName, gasFunctionArgs),
                    this.createTimeoutPromise(timeout, gasFunctionName)
                ]);

                if (result instanceof SuccessResponse) {
                    return result;
                }

                console.warn(`GAS関数 '${gasFunctionName}' の呼び出しが失敗しました (試行 ${attempts}/${retries + 1}): ${result.message}`);
                if (attempts <= retries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    return new FailedResponse(`GAS関数 '${gasFunctionName}' の呼び出しが最大リトライ回数 (${retries}) を超えて失敗しました: ${result.message}`);
                }

            } catch (error: any) {
                console.error(`GAS関数 '${gasFunctionName}' 呼び出し中に予期せぬエラーが発生しました (試行 ${attempts}/${retries + 1}):`, error.message);
                if (attempts <= retries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    return new FailedResponse(`GAS関数 '${gasFunctionName}' の呼び出しが最大リトライ回数 (${retries}) を超えて予期せぬエラーで失敗しました: ${error.message}`);
                }
            }
        }

        return new FailedResponse(`GAS関数 '${gasFunctionName}' の呼び出しが不明な理由で失敗しました。`);
    }

    /**
     * 複数のGAS関数を並列で呼び出します。
     * 各呼び出しは独立してタイムアウトとリトライのロジックに従います。
     *
     * @template T 各GAS関数が成功時に返すデータの型。
     * @param {Array<GasFunction<T>>} calls 呼び出すGasFunctionビルダーインスタンスの配列。
     * @returns {Promise<PromiseSettledResult<FinalGasCallResult<T>>[]>} 各呼び出しの最終結果を含むPromiseの配列。
     */
    public async callParallel<T>(
        calls: Array<GasFunction<T>>
    ): Promise<PromiseSettledResult<FinalGasCallResult<T>>[]> {
        const promises = calls.map(gasFunction => this.call<T>(gasFunction));
        return Promise.allSettled(promises);
    }

    /**
     * 実際のGAS関数呼び出しを実行し、JSONレスポンスをデシリアライズします。
     * @private
     * @template T サーバーサイド関数が成功時に返すデータの型。
     * @param {string} functionName 呼び出すサーバーサイド関数の名前。
     * @param {any[]} args サーバーサイド関数に渡す引数。
     * @returns {Promise<SuccessResponse<T> | ErrorResponse>} GAS関数からの結果（成功またはエラー）。
     */
    private executeGasFunction<T>(functionName: string, args: any[]): Promise<SuccessResponse<T> | ErrorResponse> {
        return new Promise((resolve) => {
            google.script.run
                .withSuccessHandler((response: string) => {
                    try {

                        console.log(JSON.parse(response));

                        const parsedResponse: { status: 'success' | 'error', data?: T, message?: string } = JSON.parse(response);
                        if (parsedResponse.status === 'success') {
                            if (parsedResponse.data !== undefined) {
                                resolve(new SuccessResponse<T>(parsedResponse.data));
                            } else {
                                resolve(new ErrorResponse(`GAS関数 '${functionName}' から成功ステータスが返されましたが、データがありません。`));
                            }
                        } else if (parsedResponse.status === 'error') {
                            resolve(new ErrorResponse(parsedResponse.message || `不明なGASエラー: ${response}`));
                        } else {
                            resolve(new ErrorResponse(`GAS関数 '${functionName}' から予期しないステータスが返されました: ${JSON.stringify(parsedResponse)}`));
                        }
                    } catch (e: any) {
                        resolve(new ErrorResponse(`GAS関数 '${functionName}' からの応答のパースに失敗しました: ${e.message}. 応答: ${response}`));
                    }
                })
                .withFailureHandler((error: Error) => {
                    resolve(new ErrorResponse(`GASクライアントエラー: ${error.message}`));
                })[functionName](...args);
        });
    }

    /**
     * タイムアウト用のPromiseを作成します。
     * @private
     * @param {number} ms タイムアウト時間（ミリ秒）。
     * @param {string} functionName タイムアウトした関数の名前（エラーメッセージ用）。
     * @returns {Promise<ErrorResponse>} タイムアウト時に解決されるPromise。
     */
    private createTimeoutPromise(ms: number, functionName: string): Promise<ErrorResponse> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(new ErrorResponse(`GAS関数 '${functionName}' の呼び出しが ${ms}ms でタイムアウトしました。`));
            }, ms);
        });
    }
}