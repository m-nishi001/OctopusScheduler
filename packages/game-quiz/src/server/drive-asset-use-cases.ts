/**
 * quizGame の Drive アセット系エンドポイント。
 *
 * ロジック本体は @octopus/infrastructures/interfaces の汎用 use-case にあり、
 * ここでは quiz-game 用のアセットフォルダ解決だけをラップする薄い層。
 */
import type {
  DriveData,
  DriveMetadata,
  ICacheRepository,
  IFileStorageRepository,
  IKeyValueRepository,
  OperationResult,
} from "@octopus/infrastructures/interfaces";
import {
  addDriveData as addDriveDataGeneric,
  getDriveData as getDriveDataGeneric,
  getDriveMetadata as getDriveMetadataGeneric,
  removeDriveData as removeDriveDataGeneric,
  resolveFolderIdPreferringProvided,
} from "@octopus/infrastructures/interfaces";

export interface DriveAssetUseCaseDeps {
  fileStorage: IFileStorageRepository;
  cache: ICacheRepository;
  kv: IKeyValueRepository;
}

const ASSET_FOLDER_PROPERTY = "quiz-game-asset-folder";

export function addQuizDriveData(
  deps: DriveAssetUseCaseDeps,
  driveData: DriveData
): OperationResult<DriveMetadata> {
  const parentFolderId = resolveFolderIdPreferringProvided(
    { kv: deps.kv },
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
    { kv: deps.kv },
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
