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

export function addQuizDriveData(
  deps: DriveAssetUseCaseDeps,
  driveData: DriveData
): OperationResult<DriveMetadata> {
  const parentFolderId = resolveFolderIdPreferringProvided(
    { kv: deps.storage },
    ASSET_FOLDER_PROPERTY,
    driveData.parentFolderId
  );
  return addDriveDataGeneric(deps, { ...driveData, parentFolderId });
}

export function getQuizDriveMetadata(
  deps: DriveAssetUseCaseDeps,
  folderId?: string
): DriveMetadata[] {
  const resolved = resolveFolderIdPreferringProvided(
    { kv: deps.storage },
    ASSET_FOLDER_PROPERTY,
    folderId
  );
  return getDriveMetadataGeneric(deps, resolved);
}

export function getQuizDriveData(
  deps: DriveAssetUseCaseDeps,
  dataId: string
): DriveData | null {
  return getDriveDataGeneric(deps, dataId);
}

export function removeQuizDriveData(
  deps: DriveAssetUseCaseDeps,
  dataId: string
): void {
  removeDriveDataGeneric(deps, dataId);
}
