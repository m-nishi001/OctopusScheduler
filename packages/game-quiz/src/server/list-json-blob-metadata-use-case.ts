import type {
  DriveMetadata,
  IFileStorageRepository,
  IKeyValueRepository,
} from "@octopus/infrastructures/interfaces";
import {
  getDriveMetadata,
  resolveFolderIdPreferringProvided,
} from "@octopus/infrastructures/interfaces";

export interface ListJsonBlobMetadataDeps {
  fileStorage: IFileStorageRepository;
  kv: IKeyValueRepository;
}

const JSON_FOLDER_PROPERTY = "quiz-game-json-folder";

/**
 * quizGame_listJsonMetaData。JSONファイルに限定したものではなく、
 * 解決したフォルダの汎用メタデータ一覧(getDriveMetadata と同じ処理)を返す(既存挙動)。
 */
export function listJsonBlobMetadata(
  deps: ListJsonBlobMetadataDeps,
  folderId?: string
): DriveMetadata[] {
  const resolved = resolveFolderIdPreferringProvided(
    { kv: deps.kv },
    JSON_FOLDER_PROPERTY,
    folderId
  );
  return getDriveMetadata({ fileStorage: deps.fileStorage }, resolved);
}
