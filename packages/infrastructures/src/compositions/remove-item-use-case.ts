import type { IKeyValueStorage } from "../interfaces/key-value-storage";
import type { ICache } from "../interfaces/cache";
import { clearDedupeState } from "./dedupe-guard";
import { decodeItemId, splitKey } from "./item-key-naming";

export interface RemoveItemUseCaseDeps {
  storage: IKeyValueStorage;
  cache: ICache;
}

export async function removeDriveData(
  deps: RemoveItemUseCaseDeps,
  storageRef: string
): Promise<void> {
  try {
    const deleted = await deps.storage.delete(storageRef);
    if (deleted) {
      // キーから復元した itemId でキャッシュをクリアする(渡された storageRef ではない)。
      const { localName } = splitKey(deleted.key);
      await clearDedupeState({ cache: deps.cache }, decodeItemId(localName));
    }
  } catch {
    // ファイルが見つからない場合は無視する(既存挙動)。
  }
}
