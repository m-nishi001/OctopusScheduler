import type { DriveJsonData, DriveMetadata } from "@octopus/infrastructures/compositions";
import { resolveFolderIdPreferringProvided } from "@octopus/infrastructures/compositions";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";

export interface AddJsonBlobDeps {
  storage: IKeyValueStorage;
}

const JSON_FOLDER_PROPERTY = "quiz-game-json-folder";

/**
 * quizGame_addJson。addDriveData とは別の命名規約(id の埋め込みは任意)であり、
 * dedupe キャッシュも使わない(既存挙動を保持)。
 */
export function addJsonBlob(
  deps: AddJsonBlobDeps,
  driveJson: DriveJsonData
): DriveMetadata {
  const namespace = resolveFolderIdPreferringProvided(
    { kv: deps.storage },
    JSON_FOLDER_PROPERTY,
    driveJson.parentFolderId
  );

  const appFileId = driveJson.appFileId ?? "";
  const localName = appFileId ? `${appFileId}_${driveJson.fileName}` : driveJson.fileName;
  const key = `${namespace}/${localName}`;

  const meta = deps.storage.putText(key, driveJson.jsonText, "application/json");

  return {
    driveDataId: appFileId || meta.key,
    fileId: meta.key,
    parentFolderId: namespace,
    lastUpdate: meta.updatedAt,
    size: meta.size,
  };
}
