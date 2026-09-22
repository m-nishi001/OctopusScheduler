import type { IFileStorageRepository } from "../file-storage-repository";
import type { ICacheRepository } from "../cache-repository";
import { clearDedupeState } from "./dedupe-guard";
import { decodeItemId } from "./drive-file-naming";

export interface RemoveDriveDataUseCaseDeps {
  fileStorage: IFileStorageRepository;
  cache: ICacheRepository;
}

export function removeDriveData(
  deps: RemoveDriveDataUseCaseDeps,
  storageRef: string
): void {
  try {
    const deleted = deps.fileStorage.deleteFile(storageRef);
    if (deleted) {
      // ファイル名から復元した itemId でキャッシュをクリアする(渡された storageRef ではない)。
      clearDedupeState({ cache: deps.cache }, decodeItemId(deleted.fileName));
    }
  } catch {
    // ファイルが見つからない場合は無視する(既存挙動)。
  }
}
