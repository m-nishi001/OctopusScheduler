import type { Asset } from "../asset";
import type { AssetDto } from "../../../applications/dto/asset-dto";

export interface IAssetRepository {
  fetchAssets(): Promise<Asset[]>;
  addAsset(asset: AssetDto): Promise<void>;
  addAssets(files: File[], onProgress?: (index: number, success: boolean) => void): Promise<{ successful: File[]; failed: File[] }>;
  updateAsset(asset: Asset): Promise<void>;
  deleteAsset(assetId: string): Promise<void>;
  deleteAssets(assetIds: string[]): Promise<void>;
  syncAssetsWithServer(): Promise<Asset[]>;
  getAssetById(assetId: string): Promise<Asset | undefined>;
}
