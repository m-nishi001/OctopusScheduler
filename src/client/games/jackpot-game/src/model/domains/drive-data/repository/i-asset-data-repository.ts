import type { Asset, AssetMetadata } from "../asset-data";

export interface IAssetDataRepository {
  addAssetData(assetData: Asset[]): Promise<Asset[]>;
  getAssetData(): Promise<Asset[]>;
  getAssetDataById(id: string): Promise<Asset | null>;
  deleteAssetData(ids: string[]): Promise<void>;
  syncAssetData(
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }>;
  replaceLocalWithDrive(
    onProgress?: (message: string) => void
  ): Promise<{ replaced: number }>;
  getAllAssetDataMetadata(): Promise<AssetMetadata[]>;
}
