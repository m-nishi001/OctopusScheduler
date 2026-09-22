import type {
  DriveJsonData,
  DriveMetadata,
  IFileStorageRepository,
  IKeyValueRepository,
} from "@octopus/infrastructures/interfaces";
import { resolveFolderIdPreferringProvided } from "@octopus/infrastructures/interfaces";

export interface AddJsonBlobDeps {
  fileStorage: IFileStorageRepository;
  kv: IKeyValueRepository;
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
  const folderId = resolveFolderIdPreferringProvided(
    { kv: deps.kv },
    JSON_FOLDER_PROPERTY,
    driveJson.parentFolderId
  );

  const appFileId = driveJson.appFileId ?? "";
  const fileName = appFileId ? `${appFileId}_${driveJson.fileName}` : driveJson.fileName;

  const meta = deps.fileStorage.createTextFile({
    folderId,
    fileName,
    mimeType: "application/json",
    content: driveJson.jsonText,
  });

  return {
    driveDataId: meta.fileName.split("_")[0] || meta.fileId,
    fileId: meta.fileId,
    parentFolderId: folderId,
    lastUpdate: meta.lastUpdate,
    size: meta.size,
  };
}
