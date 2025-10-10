import type { Asset } from "../asset";

export interface IAssetRepository {
  addAssets(
    assets: Asset[],
    onProgress?: (index: number, success: boolean) => void
  ): Promise<{ successful: Asset[]; failed: Asset[] }>;
  getAllAssets(): Promise<Asset[]>;
  syncAssets(onProgress?: (message: string) => void): Promise<void>;
  getAssetById(assetId: string): Promise<Asset | undefined>;
  deleteAssets(assetIds: string[]): Promise<void>;
}
