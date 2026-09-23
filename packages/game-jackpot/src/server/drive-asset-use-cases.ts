/**
 * jackpotGame の Drive アセット系エンドポイント。
 *
 * ロジック本体は @octopus/infrastructures/compositions の汎用 use-case にあり、
 * ここでは jackpot-game 用のアセットフォルダ解決だけをラップする薄い層。
 *
 * 既存挙動を保持: addDriveData はフォルダ解決を行わず、クライアントが渡した
 * parentFolderId をそのまま使う(quiz-game とは異なる)。getDriveMetaData のみ
 * folderId 省略時にプロパティから解決する。
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
  resolveFolderIdPreferringProvided,
} from "@octopus/infrastructures/compositions";
import type { IKeyValueStorage, ICache } from "@octopus/infrastructures/interfaces";

export interface DriveAssetUseCaseDeps {
  storage: IKeyValueStorage;
  cache: ICache;
}

const ASSET_FOLDER_PROPERTY = "jackpot-game-asset-folder";

export function addJackpotDriveData(
  deps: DriveAssetUseCaseDeps,
  driveData: DriveData
): OperationResult<DriveMetadata> {
  return addDriveDataGeneric(deps, driveData);
}

export function getJackpotDriveMetadata(
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

export function getJackpotDriveData(
  deps: DriveAssetUseCaseDeps,
  dataId: string
): DriveData | null {
  return getDriveDataGeneric(deps, dataId);
}
