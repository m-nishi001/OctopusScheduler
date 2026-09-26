/**
 * addDriveData / updateDriveData のキャッシュベースの重複排除・排他制御。
 *
 * どのインフラ(GAS/Cloudflare)でも同じ挙動になるべき純粋なビジネスルールであり、
 * ICache 契約にしか依存しない。
 */
import type { ICache } from "../interfaces/cache";
import type { OperationResult } from "./types";

const TTL_SECONDS = 3600;

export interface DedupeGuardDeps {
  cache: ICache;
}

export type DedupeCheckResult =
  | { proceed: true }
  | { proceed: false; result: OperationResult<never> };

export async function beginSave(
  deps: DedupeGuardDeps,
  itemId: string
): Promise<DedupeCheckResult> {
  const currentStatus = await deps.cache.get(itemId);
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
  await deps.cache.put(itemId, "saving", TTL_SECONDS);
  return { proceed: true };
}

export async function commitSave(deps: DedupeGuardDeps, itemId: string): Promise<void> {
  await deps.cache.put(itemId, "saved", TTL_SECONDS);
}

export async function abortSave(deps: DedupeGuardDeps, itemId: string): Promise<void> {
  await deps.cache.remove(itemId);
}

export async function beginUpdate(
  deps: DedupeGuardDeps,
  itemId: string
): Promise<DedupeCheckResult> {
  const currentStatus = await deps.cache.get(itemId);
  if (currentStatus !== "saved") {
    return {
      proceed: false,
      result: {
        status: "error",
        message: `DriveData with ID ${itemId} is not saved or is being processed.`,
      },
    };
  }
  await deps.cache.put(itemId, "updating", TTL_SECONDS);
  return { proceed: true };
}

export async function commitUpdate(deps: DedupeGuardDeps, itemId: string): Promise<void> {
  await deps.cache.put(itemId, "saved", TTL_SECONDS);
}

export async function abortUpdate(deps: DedupeGuardDeps, itemId: string): Promise<void> {
  await deps.cache.remove(itemId);
}

/** removeDriveData から呼ぶ。保存状態を無条件でクリアする。 */
export async function clearDedupeState(deps: DedupeGuardDeps, itemId: string): Promise<void> {
  await deps.cache.remove(itemId);
}
