/**
 * addDriveData / updateDriveData のキャッシュベースの重複排除・排他制御。
 *
 * どのインフラ(GAS/Cloudflare)でも同じ挙動になるべき純粋なビジネスルールであり、
 * ICacheRepository 契約にしか依存しない。
 */
import type { ICacheRepository } from "../cache-repository";
import type { OperationResult } from "../file-storage-repository";

const TTL_SECONDS = 3600;

export interface DedupeGuardDeps {
  cache: ICacheRepository;
}

export type DedupeCheckResult =
  | { proceed: true }
  | { proceed: false; result: OperationResult<never> };

export function beginSave(
  deps: DedupeGuardDeps,
  itemId: string
): DedupeCheckResult {
  const currentStatus = deps.cache.get(itemId);
  if (currentStatus === "saved") {
    return {
      proceed: false,
      result: {
        status: "duplicate",
        message: `DriveData with ID ${itemId} is already saved.`,
      },
    };
  }
  if (currentStatus === "saving") {
    return {
      proceed: false,
      result: {
        status: "error",
        message: `DriveData with ID ${itemId} is currently being saved.`,
      },
    };
  }
  deps.cache.put(itemId, "saving", TTL_SECONDS);
  return { proceed: true };
}

export function commitSave(deps: DedupeGuardDeps, itemId: string): void {
  deps.cache.put(itemId, "saved", TTL_SECONDS);
}

export function abortSave(deps: DedupeGuardDeps, itemId: string): void {
  deps.cache.remove(itemId);
}

export function beginUpdate(
  deps: DedupeGuardDeps,
  itemId: string
): DedupeCheckResult {
  const currentStatus = deps.cache.get(itemId);
  if (currentStatus !== "saved") {
    return {
      proceed: false,
      result: {
        status: "error",
        message: `DriveData with ID ${itemId} is not saved or is being processed.`,
      },
    };
  }
  deps.cache.put(itemId, "updating", TTL_SECONDS);
  return { proceed: true };
}

export function commitUpdate(deps: DedupeGuardDeps, itemId: string): void {
  deps.cache.put(itemId, "saved", TTL_SECONDS);
}

export function abortUpdate(deps: DedupeGuardDeps, itemId: string): void {
  deps.cache.remove(itemId);
}

/** removeDriveData から呼ぶ。保存状態を無条件でクリアする。 */
export function clearDedupeState(deps: DedupeGuardDeps, itemId: string): void {
  deps.cache.remove(itemId);
}
