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
/**
 * GAS関数の呼び出しが成功した際のレスポンス。
 * @template T 成功時のデータの型。
 */
export declare class SuccessResponse<T> {
    readonly status: string;
    readonly data: T;
    constructor(data: T);
}
/**
 * GAS関数の呼び出しが失敗した際のレスポンス。
 */
export declare class FailedResponse {
    readonly status: string;
    readonly message: string;
    constructor(message: string);
}
/**
 * GAS関数呼び出しのオプション（リトライ、タイムアウト）を表現する値オブジェクト。
 * 変更不可 (immutable) であり、新しいインスタンスを生成して状態を変更する。
 */
export declare class GasFunctionOptions {
    private static readonly DEFAULT_TIMEOUT_MS;
    private static readonly DEFAULT_RETRIES;
    private static readonly DEFAULT_RETRY_DELAY_MS;
    private readonly timeout;
    private readonly retries;
    private readonly retryDelay;
    constructor(retries?: number, retryDelay?: number, timeout?: number);
    getTimeout(): number;
    getRetries(): number;
    getRetryDelay(): number;
    /**
     * 新しいタイムアウト値を持つ新しいインスタンスを返す。
     */
    withTimeout(timeout: number): GasFunctionOptions;
    /**
     * 新しいリトライ回数を持つ新しいインスタンスを返す。
     */
    withRetries(retries: number): GasFunctionOptions;
    /**
     * 新しいリトライ遅延時間を持つ新しいインスタンスを返す。
     */
    withRetryDelay(retryDelay: number): GasFunctionOptions;
}
/**
 * GAS関数呼び出しというドメインの概念を表現するドメインオブジェクト。
 * データ（関数名、引数）と振る舞い（呼び出し、リトライ）をカプセル化する。
 * @template TResult 呼び出しが成功時に返すデータの型。
 */
export declare class GasFunction<TResult> implements IGasFunction<TResult> {
    functionName: string;
    args: any;
    options: GasFunctionOptions;
    private executor;
    private successHandler;
    private failureHandler;
    /**
     * このコンストラクタはアプリケーション層からのみアクセス可能。
     * 利用者は直接インスタンス化せず、GasFunctionServiceのnewCall()を使用する。
     */
    constructor(functionName: string, args: any, executor: GasScriptExecutor);
    /**
     * GAS関数に渡す引数を設定する。
     */
    withArgs(args: any): IGasFunction<TResult>;
    /**
     * リトライ回数を設定する。
     */
    withRetryCount(count: number): IGasFunction<TResult>;
    /**
     * リトライ間の待機時間を設定する（ミリ秒）。
     */
    withRetryInterval(ms: number): IGasFunction<TResult>;
    /**
     * タイムアウト時間を設定する（ミリ秒）。
     */
    withTimeout(ms: number): IGasFunction<TResult>;
    /**
     * 成功時のコールバックを設定する。
     */
    withSuccessed(callback: (result: TResult) => void): IGasFunction<TResult>;
    /**
     * 失敗時のコールバックを設定する。
     */
    withFailuered(callback: (message: string) => void): IGasFunction<TResult>;
    /**
     * GAS関数の呼び出しを実行する。
     * タイムアウト、自動リトライ、JSONレスポンスのデシリアライズを含む。
     * 成功した場合はtrue、失敗した場合はfalseを返す。
     */
    private callWithTimeout;
    private isParallelLimitError;
    private retryInvoke;
    invoke(): Promise<boolean>;
    private handleError;
}
/**
 * Google Apps Scriptの実行を専門に扱うインフラストラクチャサービス。
 * google.script.runの呼び出し、JSONのデシリアライズ、エラーハンドリングを担当する。
 */
export declare class GasFunctionService {
    private executor;
    private constructor();
    static create(apiFunctionName: string): GasFunctionService | null;
    /**
     * 新しいGasFunctionドメインオブジェクトを作成するファクトリメソッド。
     * アプリケーション層からドメイン層への入口となる。
     * @template TResult サーバーサイド関数が成功時に返すデータの型。
     * @param {string} functionName 呼び出すサーバーサイド関数の名前。
     * @param {any} args サーバーサイド関数に渡す初期引数（オプション）。
     * @returns {IGasFunction<TResult>}
     */
    createCall<TResult>(functionName: string, args?: any): IGasFunction<TResult>;
    /**
     * 複数のGAS関数を並列で実行する。
     * Promise.allSettled()を利用して、すべての呼び出しが完了するのを待つ。
     * @template T 各GAS関数が成功時に返すデータの型。
     * @param {Array<IGasFunction<T>>} calls 呼び出すGasFunctionドメインオブジェクトの配列。
     * @returns {Promise<PromiseSettledResult<boolean>[]>} 各呼び出しの最終結果を含むPromiseの配列。
     */
    all<T>(...calls: Array<IGasFunction<T>>): Promise<PromiseSettledResult<boolean>[]>;
}
export declare class GasScriptExecutor {
    private apiFunctionName;
    private responseHandlers;
    constructor(apiFunctionName: string);
    /**
     * 実際のGAS関数呼び出しを実行し、JSONレスポンスをデシリアライズする。
     * ポリモーフィズムを活用して、ステータスごとの分岐を排除している。
     */
    executeGasFunction<T>(functionName: string, args: any): Promise<SuccessResponse<T> | FailedResponse>;
    /**
     * タイムアウト用のPromiseを作成する。
     */
    createTimeoutPromise(ms: number, functionName: string): Promise<FailedResponse>;
}
