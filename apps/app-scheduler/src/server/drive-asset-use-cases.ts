/**
 * octopusScheduler(ホスト本体)の Drive アセット系エンドポイント。
 *
 * 保存先は `storage-paths` の `<module>/assets` に固定する。クライアントが
 * parentFolderId / folderId を渡しても無視する。
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

const ASSET_NAMESPACE = storageNamespace(StorageModule.Scheduler, StorageKind.Assets);

export async function addSchedulerDriveData(
  deps: DriveAssetUseCaseDeps,
  driveData: DriveData
): Promise<OperationResult<DriveMetadata>> {
  return addDriveDataGeneric(deps, { ...driveData, parentFolderId: ASSET_NAMESPACE });
}

export async function getSchedulerDriveMetadata(
  deps: DriveAssetUseCaseDeps
): Promise<DriveMetadata[]> {
  return getDriveMetadataGeneric(deps, ASSET_NAMESPACE);
}

export async function getSchedulerDriveData(
  deps: DriveAssetUseCaseDeps,
  dataId: string
): Promise<DriveData | null> {
  return getDriveDataGeneric(deps, dataId);
}

export async function updateSchedulerDriveData(
  deps: DriveAssetUseCaseDeps,
  driveData: DriveData
): Promise<OperationResult<void>> {
  return updateDriveDataGeneric(deps, driveData);
}
