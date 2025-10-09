import type { Asset } from "../asset";

export interface IAssetRepository {
  addAssets(
    assets: Asset[],
    onProgress?: (index: number, success: boolean) => void
  ): Promise<{ successful: Asset[]; failed: Asset[] }>;
  fetchAssets(): Promise<Asset[]>;
  syncAssetsWithGoogleDrive(
    onProgress?: (message: string) => void
  ): Promise<void>;
  getAssetById(assetId: string): Promise<Asset | undefined>;
  updateAssets(assets: Asset[]): Promise<void>;
  deleteAssets(assetIds: string[]): Promise<void>;
}
