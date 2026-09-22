import { injectable } from "tsyringe";
import type { ILockRepository } from "../interfaces/lock-repository";

@injectable()
export class GasLockRepository implements ILockRepository {
  tryReleaseScriptLock(): void {
    try {
      LockService.getScriptLock().releaseLock();
    } catch {
      // 保持していない場合は無視する(既存挙動)。
    }
  }
}
