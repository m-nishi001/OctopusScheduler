import { injectable } from "tsyringe";
import type { ILock } from "../interfaces/lock";

@injectable()
export class GasLock implements ILock {
  // GAS の LockService はスクリプト単位の単一ロックであり、key ごとには分離できない。
  // ILock契約のkeyパラメータはCloudflare実装(D1の行ロック)向けであり、GAS実装では無視する。
  async withLock<T>(_key: string, timeoutMs: number, fn: () => Promise<T> | T): Promise<T> {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(timeoutMs);
    } catch {
      throw new Error("Server is busy, please try again.");
    }
    try {
      return await fn();
    } finally {
      lock.releaseLock();
    }
  }
}
