import { GasFunctionOptions } from "./gas-function-options";

/**
 * GAS関数呼び出しを構成するためのビルダーパターンクラス。
 * このクラスのインスタンスを作成し、チェーンメソッドでオプションを設定する。
 *
 * @template TResult サーバーサイド関数が成功時に返すデータの型。
 */
export class GasFunction<TResult> {

    public functionName: string;
    public args: any[] = [];
    public options: GasFunctionOptions = new GasFunctionOptions();

    /**
     * GasFunctionビルダーの新しいインスタンスを作成します。
     * @param {string} functionName 呼び出すサーバーサイド関数の名前。
     * @param {any[]} args サーバーサイド関数に渡す初期引数（オプション）。
     */
    constructor(functionName: string, ...args: any[]) {
        this.functionName = functionName;
        this.args = args;
    }

    /**
     * GAS関数に渡す引数を設定します。
     * @param {any[]} args 引数の配列。
     * @returns {GasFunction<TResult>} チェーン可能なビルダーインスタンス。
     */
    public withArgs(...args: any[]): GasFunction<TResult> {
        this.args = args;
        return this;
    }

    /**
     * リトライ回数を設定します。
     * @param {number} count リトライ回数。
     * @returns {GasFunction<TResult>} チェーン可能なビルダーインスタンス。
     */
    public withRetryCount(count: number): GasFunction<TResult> {
        this.options = this.options.withRetries(count);
        return this;
    }

    /**
     * リトライ間の待機時間を設定します（ミリ秒）。
     * @param {number} ms 待機時間（ミリ秒）。
     * @returns {GasFunction<TResult>} チェーン可能なビルダーインスタンス。
     */
    public withRetryInterval(ms: number): GasFunction<TResult> {
        this.options = this.options.withRetryDelay(ms);
        return this;
    }

    /**
     * タイムアウト時間を設定します（ミリ秒）。
     * @param {number} ms タイムアウト時間（ミリ秒）。
     * @returns {GasFunction<TResult>} チェーン可能なビルダーインスタンス。
     */
    public withTimeout(ms: number): GasFunction<TResult> {
        this.options = this.options.withTimeout(ms);
        return this;
    }
}