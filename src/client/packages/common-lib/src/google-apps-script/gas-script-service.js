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
// ===================== Domain =====================
/**
 * GAS関数の呼び出しが成功した際のレスポンス。
 * @template T 成功時のデータの型。
 */
export class SuccessResponse {
    constructor(data) {
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'success'
        });
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.data = data;
    }
}
/**
 * GAS関数の呼び出しが失敗した際のレスポンス。
 */
export class FailedResponse {
    constructor(message) {
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'failed'
        });
        Object.defineProperty(this, "message", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.message = message;
    }
}
/**
 * GAS関数呼び出しのオプション（リトライ、タイムアウト）を表現する値オブジェクト。
 * 変更不可 (immutable) であり、新しいインスタンスを生成して状態を変更する。
 */
export class GasFunctionOptions {
    constructor(retries = GasFunctionOptions.DEFAULT_RETRIES, retryDelay = GasFunctionOptions.DEFAULT_RETRY_DELAY_MS, timeout = GasFunctionOptions.DEFAULT_TIMEOUT_MS) {
        Object.defineProperty(this, "timeout", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "retries", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "retryDelay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        if (retries < 0)
            throw new Error("Retries cannot be negative.");
        if (retryDelay < 0)
            throw new Error("Retry delay cannot be negative.");
        if (timeout < 0)
            throw new Error("Timeout cannot be negative.");
        this.retries = retries;
        this.retryDelay = retryDelay;
        this.timeout = timeout;
    }
    getTimeout() { return this.timeout; }
    getRetries() { return this.retries; }
    getRetryDelay() { return this.retryDelay; }
    /**
     * 新しいタイムアウト値を持つ新しいインスタンスを返す。
     */
    withTimeout(timeout) {
        return new GasFunctionOptions(this.retries, this.retryDelay, timeout);
    }
    /**
     * 新しいリトライ回数を持つ新しいインスタンスを返す。
     */
    withRetries(retries) {
        return new GasFunctionOptions(retries, this.retryDelay, this.timeout);
    }
    /**
     * 新しいリトライ遅延時間を持つ新しいインスタンスを返す。
     */
    withRetryDelay(retryDelay) {
        return new GasFunctionOptions(this.retries, retryDelay, this.timeout);
    }
}
Object.defineProperty(GasFunctionOptions, "DEFAULT_TIMEOUT_MS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 10000
});
Object.defineProperty(GasFunctionOptions, "DEFAULT_RETRIES", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 3
});
Object.defineProperty(GasFunctionOptions, "DEFAULT_RETRY_DELAY_MS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 1000
});
/**
 * GAS関数呼び出しというドメインの概念を表現するドメインオブジェクト。
 * データ（関数名、引数）と振る舞い（呼び出し、リトライ）をカプセル化する。
 * @template TResult 呼び出しが成功時に返すデータの型。
 */
export class GasFunction {
    /**
     * このコンストラクタはアプリケーション層からのみアクセス可能。
     * 利用者は直接インスタンス化せず、GasFunctionServiceのnewCall()を使用する。
     */
    constructor(functionName, args, executor) {
        Object.defineProperty(this, "functionName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "args", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "executor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "successHandler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "failureHandler", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.functionName = functionName;
        this.args = args;
        this.options = new GasFunctionOptions();
        this.executor = executor;
    }
    /**
     * GAS関数に渡す引数を設定する。
     */
    withArgs(args) {
        this.args = args;
        return this;
    }
    /**
     * リトライ回数を設定する。
     */
    withRetryCount(count) {
        this.options = this.options.withRetries(count);
        return this;
    }
    /**
     * リトライ間の待機時間を設定する（ミリ秒）。
     */
    withRetryInterval(ms) {
        this.options = this.options.withRetryDelay(ms);
        return this;
    }
    /**
     * タイムアウト時間を設定する（ミリ秒）。
     */
    withTimeout(ms) {
        this.options = this.options.withTimeout(ms);
        return this;
    }
    /**
     * 成功時のコールバックを設定する。
     */
    withSuccessed(callback) {
        this.successHandler = callback;
        return this;
    }
    /**
     * 失敗時のコールバックを設定する。
     */
    withFailuered(callback) {
        this.failureHandler = callback;
        return this;
    }
    /**
     * GAS関数の呼び出しを実行する。
     * タイムアウト、自動リトライ、JSONレスポンスのデシリアライズを含む。
     * 成功した場合はtrue、失敗した場合はfalseを返す。
     */
    async callWithTimeout(timeout) {
        return await Promise.race([
            this.executor.executeGasFunction(this.functionName, this.args),
            this.executor.createTimeoutPromise(timeout, this.functionName)
        ]);
    }
    isParallelLimitError(message) {
        return message.includes("Service invoked too many times in a short time") ||
            message.includes("Exception: Service invoked too many times");
    }
    async retryInvoke() {
        const timeout = this.options.getTimeout();
        const retries = this.options.getRetries();
        const retryDelay = this.options.getRetryDelay();
        const MAX_PARALLEL_ERROR_RETRY = 100;
        let attempts = 0;
        let parallelErrorAttempts = 0;
        while (true) {
            attempts++;
            let result;
            let errorMessage = "";
            try {
                result = await this.callWithTimeout(timeout);
                if (result instanceof SuccessResponse) {
                    if (this.successHandler)
                        this.successHandler(result.data);
                    return true;
                }
                errorMessage = result.message;
            }
            catch (error) {
                errorMessage = error.message;
            }
            const handleResult = await this.handleError(errorMessage, attempts, retries, parallelErrorAttempts, retryDelay, MAX_PARALLEL_ERROR_RETRY);
            if (this.isParallelLimitError(errorMessage))
                parallelErrorAttempts++;
            if (handleResult === "retry")
                continue;
            else
                return false;
        }
    }
    async invoke() {
        return await this.retryInvoke();
    }
    async handleError(errorMessage, attempts, retries, parallelErrorAttempts, retryDelay, maxParallelErrorRetry) {
        if (this.isParallelLimitError(errorMessage) && parallelErrorAttempts < maxParallelErrorRetry) {
            console.warn(`GAS関数 '${this.functionName}' 並列上限超過エラーでリトライ (試行 ${parallelErrorAttempts + 1}/${maxParallelErrorRetry}): ${errorMessage}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return "retry";
        }
        if (attempts <= retries) {
            console.warn(`GAS関数 '${this.functionName}' の呼び出しが失敗しました (試行 ${attempts}/${retries + 1}): ${errorMessage}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return "retry";
        }
        else {
            console.error(`GAS関数 '${this.functionName}' の呼び出しが最大リトライ回数 (${retries}) を超えて失敗しました: ${errorMessage}`);
            if (this.failureHandler)
                this.failureHandler(errorMessage);
            return "fail";
        }
    }
}
// ==============================================================================
// 2. Infrastructure (インフラストラクチャ層)
// ==============================================================================
// ===================== Infrastructure =====================
/**
 * GASサーバーからの応答を処理するための抽象クラス。
 * ポリモーフィズムを活用して、各ステータスごとの処理をカプセル化する。
 */
class GasResponseHandler {
}
/**
 * GASサーバーからの成功応答を処理する具体的なハンドラ。
 */
class SuccessResponseHandler extends GasResponseHandler {
    handle(functionName, rawResponse) {
        try {
            const parsedResponse = JSON.parse(rawResponse);
            if (parsedResponse.data !== undefined) {
                return new SuccessResponse(parsedResponse.data);
            }
            else {
                return new FailedResponse(`GAS関数 '${functionName}' から成功ステータスが返されましたが、データがありません。`);
            }
        }
        catch (e) {
            return new FailedResponse(`GAS関数 '${functionName}' からの成功応答のパースに失敗しました: ${e.message}. 応答: ${rawResponse}`);
        }
    }
}
/**
 * GASサーバーからのエラー応答を処理する具体的なハンドラ。
 */
class ErrorResponseHandler extends GasResponseHandler {
    handle(functionName, rawResponse) {
        try {
            const parsedResponse = JSON.parse(rawResponse);
            return new FailedResponse(parsedResponse.message || `不明なGASエラー: ${rawResponse}`);
        }
        catch (e) {
            return new FailedResponse(`GAS関数 '${functionName}' からの応答のパースに失敗しました: ${e.message}. 応答: ${rawResponse}`);
        }
    }
}
/**
 * 未知のGASサーバー応答を処理するデフォルトハンドラ。
 */
class DefaultResponseHandler extends GasResponseHandler {
    handle(functionName, rawResponse) {
        return new FailedResponse(`GAS関数 '${functionName}' から予期しないステータスが返されました: ${rawResponse}`);
    }
}
/**
 * Google Apps Scriptの実行を専門に扱うインフラストラクチャサービス。
 * google.script.runの呼び出し、JSONのデシリアライズ、エラーハンドリングを担当する。
 */
export class GasFunctionService {
    constructor(apiFunctionName) {
        Object.defineProperty(this, "executor", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.executor = new GasScriptExecutor(apiFunctionName);
    }
    static create(apiFunctionName) {
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
    createCall(functionName, args = {}) {
        return new GasFunction(functionName, args, this.executor);
    }
    /**
     * 複数のGAS関数を並列で実行する。
     * Promise.allSettled()を利用して、すべての呼び出しが完了するのを待つ。
     * @template T 各GAS関数が成功時に返すデータの型。
     * @param {Array<IGasFunction<T>>} calls 呼び出すGasFunctionドメインオブジェクトの配列。
     * @returns {Promise<PromiseSettledResult<boolean>[]>} 各呼び出しの最終結果を含むPromiseの配列。
     */
    async all(...calls) {
        const promises = calls.map(gasFunction => gasFunction.invoke());
        return Promise.allSettled(promises);
    }
}
// ===================== Infrastructure =====================
export class GasScriptExecutor {
    constructor(apiFunctionName) {
        Object.defineProperty(this, "apiFunctionName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "responseHandlers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
    executeGasFunction(functionName, args) {
        return new Promise((resolve) => {
            google.script.run
                .withSuccessHandler((response) => {
                try {
                    const parsedResponse = JSON.parse(response);
                    const handler = this.responseHandlers[parsedResponse.status] || new DefaultResponseHandler();
                    resolve(handler.handle(functionName, response));
                }
                catch (e) {
                    resolve(new FailedResponse(`GAS関数 '${functionName}' からの応答のパースに失敗しました: ${e.message}. 応答: ${response}`));
                }
            })
                .withFailureHandler((error) => {
                resolve(new FailedResponse(`GASクライアントエラー: ${error.message}`));
            })[this.apiFunctionName](functionName, JSON.stringify(args));
        });
    }
    /**
     * タイムアウト用のPromiseを作成する。
     */
    createTimeoutPromise(ms, functionName) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(new FailedResponse(`GAS関数 '${functionName}' の呼び出しが ${ms}ms でタイムアウトしました。`));
            }, ms);
        });
    }
}
