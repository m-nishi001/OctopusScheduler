/**
 * octopusScheduler(ホスト本体)の Drive アセット系エンドポイント。
 *
 * 保存先は `storage-paths` の `octopus-scheduler/assets` 配下に固定する。
 * 追加・更新ではクライアントの parentFolderId を無視する。一覧取得では
 * フォルダ名(1階層)を `assets` 直下のサブフォルダとして受け付ける。
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
  storagePath,
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

/** folderName 省略時は assets 直下、指定時は assets/<folderName> を一覧する。 */
export async function getSchedulerDriveMetadata(
  deps: DriveAssetUseCaseDeps,
  folderName?: string
): Promise<DriveMetadata[]> {
  const name = folderName?.trim();
  const namespace = name
    ? storagePath(StorageModule.Scheduler, StorageKind.Assets, name)
    : ASSET_NAMESPACE;
  return getDriveMetadataGeneric(deps, namespace);
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
