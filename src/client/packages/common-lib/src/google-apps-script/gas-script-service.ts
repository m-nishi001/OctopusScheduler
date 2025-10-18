/**
 * @file gas-script-service.ts
 *
 * Google Apps Scriptのクライアントサイド通信をシンプルに実装したモジュール。
 *
 * 目的：
 * - google.script.runを単純にかつJSオブジェクトチックに使用することができる
 * - google.script.runという呼び出しを隠蔽する
 * - リトライ機構を備える
 */

import type { GasResponse } from "../gas-types";

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

export interface GasFunctionOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class GasFunctionService {
  private static readonly DEFAULT_TIMEOUT_MS = 10000;
  private static readonly DEFAULT_RETRIES = 3;
  private static readonly DEFAULT_RETRY_DELAY_MS = 1000;

  private functionName?: string;
  private options: Required<GasFunctionOptions>;
  private instanceSuccessHandler: ((value: any) => void) | null = null;
  private instanceFailureHandler: ((err: string) => void) | null = null;

  constructor(functionName?: string, options: GasFunctionOptions = {}) {
    if (functionName && String(functionName).trim() !== "") {
      this.functionName = String(functionName).trim();
    }

    this.options = {
      timeout: options.timeout ?? GasFunctionService.DEFAULT_TIMEOUT_MS,
      retries: options.retries ?? GasFunctionService.DEFAULT_RETRIES,
      retryDelay:
        options.retryDelay ?? GasFunctionService.DEFAULT_RETRY_DELAY_MS,
    };
  }

  public withSuccessHandler(handler: (value: any) => void): this {
    this.instanceSuccessHandler = handler;
    return this;
  }

  public withFailureHandler(handler: (message: string) => void): this {
    this.instanceFailureHandler = handler;
    return this;
  }

  public async call<T = any>(args: any = {}): Promise<T> {
    const resp = await this.runWithRetry<T>(args);

    if (resp.status === "success") {
      if (this.instanceSuccessHandler) {
        try {
          this.instanceSuccessHandler(resp.data);
        } catch (_e) {
          // ignore handler errors
        }
      }
      return resp.data as T;
    }

    if (this.instanceFailureHandler) {
      try {
        this.instanceFailureHandler(resp.message);
      } catch (_e) {
        // ignore handler errors
      }
    }

    throw new Error(resp.message);
  }

  private async runWithRetry<T>(args: any): Promise<GasResponse<T>> {
    let attempts = 0;
    let parallelErrorAttempts = 0;
    const MAX_PARALLEL_ERROR_RETRY = 100;

    while (true) {
      attempts++;

      try {
        const result = await Promise.race([
          this.executeGasFunction<T>(args),
          this.createTimeoutPromise(this.functionName ?? "anonymous"),
        ]);

        if (result.status === "success") return result;

        const msg = result.message ?? "Unknown error";

        if (
          this.isParallelLimitError(msg) &&
          parallelErrorAttempts < MAX_PARALLEL_ERROR_RETRY
        ) {
          parallelErrorAttempts++;
          await new Promise((r) => setTimeout(r, this.options.retryDelay));
          continue;
        }

        if (attempts <= this.options.retries) {
          await new Promise((r) => setTimeout(r, this.options.retryDelay));
          continue;
        }

        return { status: "error", message: msg };
      } catch (error: any) {
        const msg = error?.message ?? String(error ?? "");

        if (
          this.isParallelLimitError(msg) &&
          parallelErrorAttempts < MAX_PARALLEL_ERROR_RETRY
        ) {
          parallelErrorAttempts++;
          await new Promise((r) => setTimeout(r, this.options.retryDelay));
          continue;
        }

        if (attempts <= this.options.retries) {
          await new Promise((r) => setTimeout(r, this.options.retryDelay));
          continue;
        }

        return { status: "error", message: msg };
      }
    }
  }

  private executeGasFunction<T>(args: any): Promise<GasResponse<T>> {
    return new Promise((resolve) => {
      const runTarget =
        this.functionName && this.functionName.trim() !== ""
          ? this.functionName
          : undefined;

      const successHandler = (response: string) => {
        try {
          const parsed: GasResponse<T> = JSON.parse(response);
          resolve(parsed);
        } catch (e: any) {
          resolve({
            status: "error",
            message: `応答のパースに失敗しました: ${e.message}. 応答: ${response}`,
          });
        }
      };

      const failureHandler = (error: Error) => {
        resolve({
          status: "error",
          message: `クライアントエラー: ${error.message}`,
        });
      };

      const callWith = google.script.run
        .withSuccessHandler(successHandler)
        .withFailureHandler(failureHandler);

      if (runTarget) {
        (callWith as any)[runTarget](args);
      } else {
        resolve({
          status: "error",
          message: "呼び出すGAS関数名が指定されていません。",
        });
      }
    });
  }

  private createTimeoutPromise(functionName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `GAS関数 '${functionName}' の呼び出しが ${this.options.timeout}ms でタイムアウトしました。`
          )
        );
      }, this.options.timeout);
    });
  }

  private isParallelLimitError(message: string): boolean {
    return (
      message.includes("Service invoked too many times in a short time") ||
      message.includes("Exception: Service invoked too many times")
    );
  }
}
