/**
 * リクエストスコープの排他制御の抽象化(GASでは LockService)。
 */
export interface ILock {
  /** key に対するロックを取得して fn を実行する。取得できない場合は例外を投げる。 */
  withLock<T>(key: string, timeoutMs: number, fn: () => Promise<T> | T): Promise<T>;
}

export const ILockToken = Symbol("ILock");
