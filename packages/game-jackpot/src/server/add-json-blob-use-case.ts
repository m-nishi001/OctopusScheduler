import type { DriveJsonData, DriveMetadata } from "@octopus/infrastructures/compositions";
import {
  StorageKind,
  StorageModule,
  storageNamespace,
  storagePath,
} from "@octopus/infrastructures/compositions";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";

export interface AddJsonBlobDeps {
  storage: IKeyValueStorage;
}

/**
 * jackpotGame_addJson。addDriveData とは別の命名規約(id の埋め込みは任意)であり、
 * dedupe キャッシュも使わない(既存挙動を保持)。
 */
export async function addJsonBlob(
  deps: AddJsonBlobDeps,
  driveJson: DriveJsonData
): Promise<DriveMetadata> {
  const appFileId = driveJson.appFileId ?? "";
  const localName = appFileId ? `${appFileId}_${driveJson.fileName}` : driveJson.fileName;
  const key = storagePath(StorageModule.Jackpot, StorageKind.Json, localName);

  const meta = await deps.storage.putText(key, driveJson.jsonText, "application/json");

  return {
    driveDataId: appFileId || meta.key,
    fileId: meta.key,
    parentFolderId: storageNamespace(StorageModule.Jackpot, StorageKind.Json),
    lastUpdate: meta.updatedAt,
    size: meta.size,
  };
}
