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

/**
 * GAS関数呼び出しのオプション。
 */
export interface GasFunctionOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Google Apps Script関数呼び出しサービス。
 * JSオブジェクトチックにGAS関数を呼び出すことができる。
 * リトライ機構とタイムアウトを備える。
 */
export class GasFunctionService {
  private static readonly DEFAULT_TIMEOUT_MS = 10000;
  private static readonly DEFAULT_RETRIES = 3;
  private static readonly DEFAULT_RETRY_DELAY_MS = 1000;

  private options: Required<GasFunctionOptions>;

  constructor(options: GasFunctionOptions = {}) {
    this.options = {
      timeout: options.timeout ?? GasFunctionService.DEFAULT_TIMEOUT_MS,
      retries: options.retries ?? GasFunctionService.DEFAULT_RETRIES,
      retryDelay:
        options.retryDelay ?? GasFunctionService.DEFAULT_RETRY_DELAY_MS,
    };
  }

  /**
   * GAS関数を呼び出す。
   * @param functionName 呼び出す関数名
   * @param args 引数
   * @returns Promise<T> 成功時のデータ
   */
  public async call<T = any>(functionName: string, args: any = {}): Promise<T> {
    return this.callWithRetry<T>(functionName, args);
  }

  /**
   * Proxyを使って、service.functionName(args) のように呼び出せるようにする。
   */
  public get proxy(): any {
    return new Proxy(this, {
      get: (target, prop: string) => {
        if (
          typeof prop === "string" &&
          prop !== "proxy" &&
          prop !== "call" &&
          prop !== "callWithRetry"
        ) {
          return (args: any = {}) => this.call(prop, args);
        }
        return (target as any)[prop];
      },
    });
  }

  private async callWithRetry<T>(functionName: string, args: any): Promise<T> {
    let attempts = 0;
    let parallelErrorAttempts = 0;
    const MAX_PARALLEL_ERROR_RETRY = 100;

    while (true) {
      attempts++;

      try {
        const result = await Promise.race([
          this.executeGasFunction<T>(functionName, args),
          this.createTimeoutPromise(functionName),
        ]);

        if (result.status === "success") {
          return result.data;
        } else {
          throw new Error(result.message);
        }
      } catch (error: any) {
        const errorMessage = error.message;

        if (
          this.isParallelLimitError(errorMessage) &&
          parallelErrorAttempts < MAX_PARALLEL_ERROR_RETRY
        ) {
          parallelErrorAttempts++;
          console.warn(
            `GAS関数 '${functionName}' 並列上限超過エラーでリトライ (試行 ${parallelErrorAttempts}/${MAX_PARALLEL_ERROR_RETRY}): ${errorMessage}`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this.options.retryDelay)
          );
          continue;
        }

        if (attempts <= this.options.retries) {
          console.warn(
            `GAS関数 '${functionName}' の呼び出しが失敗しました (試行 ${attempts}/${this.options.retries + 1}): ${errorMessage}`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this.options.retryDelay)
          );
          continue;
        } else {
          console.error(
            `GAS関数 '${functionName}' の呼び出しが最大リトライ回数 (${this.options.retries}) を超えて失敗しました: ${errorMessage}`
          );
          throw error;
        }
      }
    }
  }

  private executeGasFunction<T>(
    functionName: string,
    args: any
  ): Promise<GasResponse<T>> {
    return new Promise((resolve) => {
      google.script.run
        .withSuccessHandler((response: string) => {
          try {
            const parsed: GasResponse<T> = JSON.parse(response);
            resolve(parsed);
          } catch (e: any) {
            resolve({
              status: "error",
              message: `応答のパースに失敗しました: ${e.message}. 応答: ${response}`,
            });
          }
        })
        .withFailureHandler((error: Error) => {
          resolve({
            status: "error",
            message: `クライアントエラー: ${error.message}`,
          });
        })
        [functionName](args);
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
