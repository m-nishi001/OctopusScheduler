/**
 * quizGame の Drive アセット系エンドポイント。
 *
 * ロジック本体は @octopus/infrastructures/compositions の汎用 use-case にあり、
 * ここでは保存先(`storage-paths` の `quiz-game/assets`)を固定するだけの薄い層。
 * クライアントが parentFolderId / folderId を渡しても無視する。
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
  updateDriveData as updateDriveDataGeneric,
  StorageKind,
  StorageModule,
  storageNamespace,
} from "@octopus/infrastructures/compositions";
import type { IKeyValueStorage, ICache } from "@octopus/infrastructures/interfaces";

export interface DriveAssetUseCaseDeps {
  storage: IKeyValueStorage;
  cache: ICache;
}

const ASSET_NAMESPACE = storageNamespace(StorageModule.Quiz, StorageKind.Assets);

export async function addQuizDriveData(
  deps: DriveAssetUseCaseDeps,
  driveData: DriveData
): Promise<OperationResult<DriveMetadata>> {
  return addDriveDataGeneric(deps, { ...driveData, parentFolderId: ASSET_NAMESPACE });
}

export async function getQuizDriveMetadata(
  deps: DriveAssetUseCaseDeps
): Promise<DriveMetadata[]> {
  return getDriveMetadataGeneric(deps, ASSET_NAMESPACE);
}

export async function getQuizDriveData(
  deps: DriveAssetUseCaseDeps,
  dataId: string
): Promise<DriveData | null> {
  return getDriveDataGeneric(deps, dataId);
}

export async function updateQuizDriveData(
  deps: DriveAssetUseCaseDeps,
  driveData: DriveData
): Promise<OperationResult<void>> {
  return updateDriveDataGeneric(deps, driveData);
}
