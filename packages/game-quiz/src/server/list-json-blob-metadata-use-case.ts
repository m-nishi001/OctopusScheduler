import type { DriveMetadata } from "@octopus/infrastructures/compositions";
import {
  getDriveMetadata,
  resolveFolderIdPreferringProvided,
} from "@octopus/infrastructures/compositions";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";

export interface ListJsonBlobMetadataDeps {
  storage: IKeyValueStorage;
}

const JSON_FOLDER_PROPERTY = "quiz-game-json-folder";

/**
 * quizGame_listJsonMetaData。JSONファイルに限定したものではなく、
 * 解決したフォルダの汎用メタデータ一覧(getDriveMetadata と同じ処理)を返す(既存挙動)。
 */
export async function listJsonBlobMetadata(
  deps: ListJsonBlobMetadataDeps,
  folderId?: string
): Promise<DriveMetadata[]> {
  const resolved = await resolveFolderIdPreferringProvided(
    { kv: deps.storage },
    JSON_FOLDER_PROPERTY,
    folderId
  );
  return getDriveMetadata({ storage: deps.storage }, resolved);
}
