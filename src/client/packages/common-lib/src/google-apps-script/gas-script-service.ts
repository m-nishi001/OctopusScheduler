/**
 * @file gas-script-service.ts
 *
 * Google Apps Scriptのクライアントサイド通信を、ドメイン駆動設計（DDD）とファサードパターンを
 * 活用して再設計したモジュール。
 *
 * レイヤー構造：
 * 1. Domain (ドメイン層):
 * - アプリケーションの中核となるビジネスロジックとルールを表現する。
 * - GasFunction: GAS関数の呼び出しというドメインの概念を表現する。
 * 自身の呼び出し（invoke）という振る舞いを持ち、タイムアウトやリトライのロジックをカプセル化する。
 * - GasFunctionOptions: 呼び出しに関する設定（リトライ回数、タイムアウトなど）を値オブジェクトとして表現する。
 *
 * 2. Infrastructure (インフラストラクチャ層):
 * - ドメイン層のロジックを支える技術的な詳細（google.script.runとの通信）を扱う。
 * - GasScriptExecutor: 実際のgoogle.script.runの呼び出しと、レスポンスのパースを専門に担当する。
 *
 * 3. Application (アプリケーション層):
 * - ユーザーのユースケース（機能）を調整する。
 * - GasFunctionService: ドメイン層のオブジェクト（GasFunction）を操作し、
 * インフラストラクチャ層（GasScriptExecutor）を利用して、
 * ユーザーリクエストを実行する。ファサードとして、利用者にシンプルなインターフェースを提供する。
 *
 * この設計により、ドメイン層はインフラストラクチャから独立し、
 * ビジネスロジックがより表現豊かでテストしやすいものになっている。
 */

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

// ==============================================================================
// 1. Domain (ドメイン層)
// ==============================================================================

// 関数呼び出しの最終結果を判定するための型
// この型は、コールバックを導入する改修により、利用側からは直接参照されなくなる
type FinalGasCallResult<T> = Domain.SuccessResponse<T> | Domain.FailedResponse;

/**
 * GAS関数の呼び出しというドメインの概念を表現するインターフェース。
 * 成功時と失敗時のコールバック設定、および最終的な呼び出しを実行するメソッドを定義する。
 * @template TResult 呼び出しが成功時に返すデータの型。
 */
export interface IGasFunction<TResult> {
    functionName: string;
    withArgs(args: any): IGasFunction<TResult>;
    withRetryCount(count: number): IGasFunction<TResult>;
    withRetryInterval(ms: number): IGasFunction<TResult>;
    withTimeout(ms: number): IGasFunction<TResult>;
    withSuccessed(callback: (result: TResult) => void): IGasFunction<TResult>;
    withFailuered(callback: (message: string) => void): IGasFunction<TResult>;
    invoke(): Promise<boolean>;
}

namespace Domain {
    /**
     * GAS関数の呼び出しが成功した際のレスポンス。
     * @template T 成功時のデータの型。
     */
    export class SuccessResponse<T> {
        public readonly status: string = 'success';
        public readonly data: T;
        constructor(data: T) {
            this.data = data;
        }
    }

    /**
     * GAS関数の呼び出しが失敗した際のレスポンス。
     */
    export class FailedResponse {
        public readonly status: string = 'failed';
        public readonly message: string;
        constructor(message: string) {
            this.message = message;
        }
    }

    /**
     * GAS関数呼び出しのオプション（リトライ、タイムアウト）を表現する値オブジェクト。
     * 変更不可 (immutable) であり、新しいインスタンスを生成して状態を変更する。
     */
    export class GasFunctionOptions {
        private static readonly DEFAULT_TIMEOUT_MS = 10000;
        private static readonly DEFAULT_RETRIES = 3;
        private static readonly DEFAULT_RETRY_DELAY_MS = 1000;

        private readonly timeout: number;
        private readonly retries: number;
        private readonly retryDelay: number;

        constructor(
            retries: number = GasFunctionOptions.DEFAULT_RETRIES,
            retryDelay: number = GasFunctionOptions.DEFAULT_RETRY_DELAY_MS,
            timeout: number = GasFunctionOptions.DEFAULT_TIMEOUT_MS
        ) {
            if (retries < 0) throw new Error("Retries cannot be negative.");
            if (retryDelay < 0) throw new Error("Retry delay cannot be negative.");
            if (timeout < 0) throw new Error("Timeout cannot be negative.");

            this.retries = retries;
            this.retryDelay = retryDelay;
            this.timeout = timeout;
        }

        getTimeout(): number { return this.timeout; }
        getRetries(): number { return this.retries; }
        getRetryDelay(): number { return this.retryDelay; }

        /**
         * 新しいタイムアウト値を持つ新しいインスタンスを返す。
         */
        withTimeout(timeout: number): GasFunctionOptions {
            return new GasFunctionOptions(this.retries, this.retryDelay, timeout);
        }

        /**
         * 新しいリトライ回数を持つ新しいインスタンスを返す。
         */
        withRetries(retries: number): GasFunctionOptions {
            return new GasFunctionOptions(retries, this.retryDelay, this.timeout);
        }

        /**
         * 新しいリトライ遅延時間を持つ新しいインスタンスを返す。
         */
        withRetryDelay(retryDelay: number): GasFunctionOptions {
            return new GasFunctionOptions(this.retries, retryDelay, this.timeout);
        }
    }

    /**
     * GAS関数呼び出しというドメインの概念を表現するドメインオブジェクト。
     * データ（関数名、引数）と振る舞い（呼び出し、リトライ）をカプセル化する。
     * @template TResult 呼び出しが成功時に返すデータの型。
     */
    export class GasFunction<TResult> implements IGasFunction<TResult> {
        public functionName: string;
        public args: any;
        public options: GasFunctionOptions;
        private executor: Infrastructure.GasScriptExecutor;
        private successHandler: ((result: TResult) => void) | null = null;
        private failureHandler: ((message: string) => void) | null = null;

        /**
         * このコンストラクタはアプリケーション層からのみアクセス可能。
         * 利用者は直接インスタンス化せず、GasFunctionServiceのnewCall()を使用する。
         */
        constructor(functionName: string, args: any, executor: Infrastructure.GasScriptExecutor) {
            this.functionName = functionName;
            this.args = args;
            this.options = new GasFunctionOptions();
            this.executor = executor;
        }

        /**
         * GAS関数に渡す引数を設定する。
         */
        public withArgs(args: any): IGasFunction<TResult> {
            this.args = args;
            return this;
        }

        /**
         * リトライ回数を設定する。
         */
        public withRetryCount(count: number): IGasFunction<TResult> {
            this.options = this.options.withRetries(count);
            return this;
        }

        /**
         * リトライ間の待機時間を設定する（ミリ秒）。
         */
        public withRetryInterval(ms: number): IGasFunction<TResult> {
            this.options = this.options.withRetryDelay(ms);
            return this;
        }

        /**
         * タイムアウト時間を設定する（ミリ秒）。
         */
        public withTimeout(ms: number): IGasFunction<TResult> {
            this.options = this.options.withTimeout(ms);
            return this;
        }

        /**
         * 成功時のコールバックを設定する。
         */
        public withSuccessed(callback: (result: TResult) => void): IGasFunction<TResult> {
            this.successHandler = callback;
            return this;
        }

        /**
         * 失敗時のコールバックを設定する。
         */
        public withFailuered(callback: (message: string) => void): IGasFunction<TResult> {
            this.failureHandler = callback;
            return this;
        }

        /**
         * GAS関数の呼び出しを実行する。
         * タイムアウト、自動リトライ、JSONレスポンスのデシリアライズを含む。
         * 成功した場合はtrue、失敗した場合はfalseを返す。
         */
        public async invoke(): Promise<boolean> {
            const timeout = this.options.getTimeout();
            const retries = this.options.getRetries();
            const retryDelay = this.options.getRetryDelay();

            let attempts = 0;
            while (attempts <= retries) {
                attempts++;
                try {
                    const result = await Promise.race([
                        this.executor.executeGasFunction<TResult>(this.functionName, this.args),
                        this.executor.createTimeoutPromise(timeout, this.functionName)
                    ]);

                    if (result instanceof Domain.SuccessResponse) {
                        // 成功ハンドラを実行し、trueを返す
                        if (this.successHandler) {
                            this.successHandler(result.data);
                        }
                        return true;
                    }

                    const errorMessage = result.message;
                    if (attempts <= retries) {
                        console.warn(`GAS関数 '${this.functionName}' の呼び出しが失敗しました (試行 ${attempts}/${retries + 1}): ${errorMessage}`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    } else {
                        console.error(`GAS関数 '${this.functionName}' の呼び出しが最大リトライ回数 (${retries}) を超えて失敗しました: ${errorMessage}`);
                        // 失敗ハンドラを実行し、falseを返す
                        if (this.failureHandler) {
                            this.failureHandler(errorMessage);
                        }
                        return false;
                    }
                } catch (error: any) {
                    const errorMessage = error.message;
                    if (attempts <= retries) {
                        console.error(`GAS関数 '${this.functionName}' 呼び出し中に予期せぬエラーが発生しました (試行 ${attempts}/${retries + 1}):`, errorMessage);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    } else {
                        console.error(`GAS関数 '${this.functionName}' の呼び出しが最大リトライ回数 (${retries}) を超えて予期せぬエラーで失敗しました: ${errorMessage}`);
                        // 失敗ハンドラを実行し、falseを返す
                        if (this.failureHandler) {
                            this.failureHandler(errorMessage);
                        }
                        return false;
                    }
                }
            }

            // ここに到達することは通常ないが、念のためfalseを返す
            if (this.failureHandler) {
                this.failureHandler(`GAS関数 '${this.functionName}' の呼び出しが不明な理由で失敗しました。`);
            }
            return false;
        }
    }
}

// ==============================================================================
// 2. Infrastructure (インフラストラクチャ層)
// ==============================================================================

namespace Infrastructure {
    /**
     * GASサーバーからの応答を処理するための抽象クラス。
     * ポリモーフィズムを活用して、各ステータスごとの処理をカプセル化する。
     */
    abstract class GasResponseHandler<T> {
        abstract handle(functionName: string, rawResponse: string): Domain.SuccessResponse<T> | Domain.FailedResponse;
    }

    /**
     * GASサーバーからの成功応答を処理する具体的なハンドラ。
     */
    class SuccessResponseHandler<T> extends GasResponseHandler<T> {
        handle(functionName: string, rawResponse: string): Domain.SuccessResponse<T> | Domain.FailedResponse {
            try {
                const parsedResponse: { status: 'success', data?: T } = JSON.parse(rawResponse);
                if (parsedResponse.data !== undefined) {
                    return new Domain.SuccessResponse<T>(parsedResponse.data);
                } else {
                    return new Domain.FailedResponse(`GAS関数 '${functionName}' から成功ステータスが返されましたが、データがありません。`);
                }
            } catch (e: any) {
                return new Domain.FailedResponse(`GAS関数 '${functionName}' からの成功応答のパースに失敗しました: ${e.message}. 応答: ${rawResponse}`);
            }
        }
    }

    /**
     * GASサーバーからのエラー応答を処理する具体的なハンドラ。
     */
    class ErrorResponseHandler<T> extends GasResponseHandler<T> {
        handle(functionName: string, rawResponse: string): Domain.SuccessResponse<T> | Domain.FailedResponse {
            try {
                const parsedResponse: { status: 'error', message?: string } = JSON.parse(rawResponse);
                return new Domain.FailedResponse(parsedResponse.message || `不明なGASエラー: ${rawResponse}`);
            } catch (e: any) {
                return new Domain.FailedResponse(`GAS関数 '${functionName}' からの応答のパースに失敗しました: ${e.message}. 応答: ${rawResponse}`);
            }
        }
    }

    /**
     * 未知のGASサーバー応答を処理するデフォルトハンドラ。
     */
    class DefaultResponseHandler<T> extends GasResponseHandler<T> {
        handle(functionName: string, rawResponse: string): Domain.SuccessResponse<T> | Domain.FailedResponse {
            return new Domain.FailedResponse(`GAS関数 '${functionName}' から予期しないステータスが返されました: ${rawResponse}`);
        }
    }

    /**
     * Google Apps Scriptの実行を専門に扱うインフラストラクチャサービス。
     * google.script.runの呼び出し、JSONのデシリアライズ、エラーハンドリングを担当する。
     */
    export class GasScriptExecutor {
        private apiFunctionName: string;
        private responseHandlers: { [key: string]: GasResponseHandler<any> };

        constructor(apiFunctionName: string) {
            this.apiFunctionName = apiFunctionName;
            this.responseHandlers = {
                'success': new SuccessResponseHandler(),
                'error': new ErrorResponseHandler(),
            };
        }

        /**
         * 実際のGAS関数呼び出しを実行し、JSONレスポンスをデシリアライズする。
         * ポリモーフィズムを活用して、ステータスごとの分岐を排除している。
         */
        public executeGasFunction<T>(functionName: string, args: any): Promise<Domain.SuccessResponse<T> | Domain.FailedResponse> {
            return new Promise((resolve) => {
                google.script.run
                    .withSuccessHandler((response: string) => {
                        try {
                            const parsedResponse: { status: string, [key: string]: any } = JSON.parse(response);
                            const handler = this.responseHandlers[parsedResponse.status] || new DefaultResponseHandler();
                            resolve(handler.handle(functionName, response));
                        } catch (e: any) {
                            resolve(new Domain.FailedResponse(`GAS関数 '${functionName}' からの応答のパースに失敗しました: ${e.message}. 応答: ${response}`));
                        }
                    })
                    .withFailureHandler((error: Error) => {
                        resolve(new Domain.FailedResponse(`GASクライアントエラー: ${error.message}`));
                    })[this.apiFunctionName](functionName, JSON.stringify(args));
            });
        }

        /**
         * タイムアウト用のPromiseを作成する。
         */
        public createTimeoutPromise(ms: number, functionName: string): Promise<Domain.FailedResponse> {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve(new Domain.FailedResponse(`GAS関数 '${functionName}' の呼び出しが ${ms}ms でタイムアウトしました。`));
                }, ms);
            });
        }
    }
}

// ==============================================================================
// 3. Application (アプリケーション層)
// ==============================================================================

namespace Application {
    import GasFunction = Domain.GasFunction;

    /**
     * GAS関数呼び出しのユースケースを調整するアプリケーションサービス。
     * ドメインモデル（GasFunction）の生成と操作を担当する。
     */
    export class GasFunctionService {
        private executor: Infrastructure.GasScriptExecutor;

        private constructor(apiFunctionName: string) {
            this.executor = new Infrastructure.GasScriptExecutor(apiFunctionName);
        }

        public static create(apiFunctionName: string): GasFunctionService | null {
            const functionName = apiFunctionName.trim();
            if (functionName === "") {
                console.error(`[GasFunctionService] apiFunctionName is empty.`);
                return null;
            }
            return new GasFunctionService(apiFunctionName);
        }

        /**
         * 新しいGasFunctionドメインオブジェクトを作成するファクトリメソッド。
         * アプリケーション層からドメイン層への入口となる。
         * @template TResult サーバーサイド関数が成功時に返すデータの型。
         * @param {string} functionName 呼び出すサーバーサイド関数の名前。
         * @param {any} args サーバーサイド関数に渡す初期引数（オプション）。
         * @returns {IGasFunction<TResult>}
         */
        public createCall<TResult>(functionName: string, args: any = {}): IGasFunction<TResult> {
            return new GasFunction<TResult>(functionName, args, this.executor);
        }

        /**
         * 複数のGAS関数を並列で実行する。
         * Promise.allSettled()を利用して、すべての呼び出しが完了するのを待つ。
         * @template T 各GAS関数が成功時に返すデータの型。
         * @param {Array<IGasFunction<T>>} calls 呼び出すGasFunctionドメインオブジェクトの配列。
         * @returns {Promise<PromiseSettledResult<boolean>[]>} 各呼び出しの最終結果を含むPromiseの配列。
         */
        public async all<T>(...calls: Array<IGasFunction<T>>): Promise<PromiseSettledResult<boolean>[]> {
            const promises = calls.map(gasFunction => gasFunction.invoke());
            return Promise.allSettled(promises);
        }
    }
}

export const GasFunctionOptions = Domain.GasFunctionOptions;
export const GasFunctionService = Application.GasFunctionService;
export type SuccessResponse<T> = Domain.SuccessResponse<T>;
export type FailedResponse = Domain.FailedResponse;
