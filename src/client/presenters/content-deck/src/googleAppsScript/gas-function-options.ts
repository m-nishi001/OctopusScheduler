/**
 * GAS関数呼び出しのオプション。
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
        if (retries < 0) {
            throw new Error("Retries cannot be negative.");
        }
        if (retryDelay < 0) {
            throw new Error("Retry delay cannot be negative.");
        }
        if (timeout < 0) {
            throw new Error("Timeout cannot be negative.");
        }

        this.retries = retries;
        this.retryDelay = retryDelay;
        this.timeout = timeout;
    }

    getTimeout(): number {
        return this.timeout;
    }
    getRetries(): number {
        return this.retries;
    }
    getRetryDelay(): number {
        return this.retryDelay;
    }
    withTimeout(timeout: number): GasFunctionOptions {
        return new GasFunctionOptions(this.retries, this.retryDelay, timeout);
    }
    withRetries(retries: number): GasFunctionOptions {
        return new GasFunctionOptions(retries, this.retryDelay, this.timeout);
    }
    withRetryDelay(retryDelay: number): GasFunctionOptions {
        return new GasFunctionOptions(this.retries, retryDelay, this.timeout);
    }
}