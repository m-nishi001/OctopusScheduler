/**
 * octopusScheduler(ホスト本体)の Drive アセット系エンドポイント。
 *
 * 既存挙動を保持: addDriveData/updateDriveData はクライアント指定の
 * parentFolderId を無視し、常にプロパティから解決する。getDriveMetaData は
 * クライアント指定があればそれを優先する(jackpot/quiz と同じ「優先」ポリシー)。
 * この非対称性は意図的な既存挙動であり統一しない。
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
  resolveFolderIdIgnoringProvided,
  resolveFolderIdPreferringProvided,
} from "@octopus/infrastructures/compositions";
import type { IKeyValueStorage, ICache } from "@octopus/infrastructures/interfaces";

export interface DriveAssetUseCaseDeps {
  storage: IKeyValueStorage;
  cache: ICache;
}

const ASSET_FOLDER_PROPERTY = "octopus-scheduler-asset-folder";

export function addSchedulerDriveData(
  deps: DriveAssetUseCaseDeps,
  driveData: DriveData
): OperationResult<DriveMetadata> {
  const parentFolderId = resolveFolderIdIgnoringProvided(
    { kv: deps.storage },
    ASSET_FOLDER_PROPERTY
  );
  return addDriveDataGeneric(deps, { ...driveData, parentFolderId });
}

export function getSchedulerDriveMetadata(
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

export function getSchedulerDriveData(
  deps: DriveAssetUseCaseDeps,
  dataId: string
): DriveData | null {
  return getDriveDataGeneric(deps, dataId);
}

export function updateSchedulerDriveData(
  deps: DriveAssetUseCaseDeps,
  driveData: DriveData
): OperationResult<void> {
  return updateDriveDataGeneric(deps, driveData);
}
