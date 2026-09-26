/**
 * quizGame の Drive アセット系エンドポイント。
 *
 * ロジック本体は @octopus/infrastructures/compositions の汎用 use-case にあり、
 * ここでは quiz-game 用のアセットフォルダ解決だけをラップする薄い層。
 */
import type {
  DriveData,
  DriveMetadata,
  OperationResult,
} from "@octopus/infrastructures/compositions";
import {
  addDriveData as addDriveDataGeneric,
  getDriveData as getDriveDataGeneric,
  getDriveMetadata as getDriveMetadataGeneric,
  removeDriveData as removeDriveDataGeneric,
  resolveFolderIdPreferringProvided,
} from "@octopus/infrastructures/compositions";
import type { IKeyValueStorage, ICache } from "@octopus/infrastructures/interfaces";

export interface DriveAssetUseCaseDeps {
  storage: IKeyValueStorage;
  cache: ICache;
}

const ASSET_FOLDER_PROPERTY = "quiz-game-asset-folder";

export async function addQuizDriveData(
  deps: DriveAssetUseCaseDeps,
  driveData: DriveData
): Promise<OperationResult<DriveMetadata>> {
  const parentFolderId = await resolveFolderIdPreferringProvided(
    { kv: deps.storage },
    ASSET_FOLDER_PROPERTY,
    driveData.parentFolderId
  );
  return addDriveDataGeneric(deps, { ...driveData, parentFolderId });
}

export async function getQuizDriveMetadata(
  deps: DriveAssetUseCaseDeps,
  folderId?: string
): Promise<DriveMetadata[]> {
  const resolved = await resolveFolderIdPreferringProvided(
    { kv: deps.storage },
    ASSET_FOLDER_PROPERTY,
    folderId
  );
  return getDriveMetadataGeneric(deps, resolved);
}

export async function getQuizDriveData(
  deps: DriveAssetUseCaseDeps,
  dataId: string
): Promise<DriveData | null> {
  return getDriveDataGeneric(deps, dataId);
}

export async function removeQuizDriveData(
  deps: DriveAssetUseCaseDeps,
  dataId: string
): Promise<void> {
  await removeDriveDataGeneric(deps, dataId);
}
