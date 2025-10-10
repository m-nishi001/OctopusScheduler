import type { Asset } from "../asset";
import { AssetMetadataDto } from "../../../applications/asset/dto/asset-dto";

export interface IAssetRepository {
  uploadAsset(asset: Asset): Promise<string>;
  uploadAssets(
    assets: Asset[],
    onProgress?: (index: number, success: boolean) => void
  ): Promise<{ successful: Asset[]; failed: Asset[] }>;
  getAsset(id: string): Promise<Asset | null>;
  findAll(): Promise<Asset[]>;
  findAllIds(): Promise<string[]>;
  findAllMetadata(): Promise<AssetMetadataDto[]>;
  updateAsset(
    id: string,
    updateAsset: (asset: Asset) => Asset
  ): Promise<string>;
  updateManyAssets(
    ids: string[],
    updateAsset: (asset: Asset) => Asset
  ): Promise<string[]>;
  deleteAsset(id: string): Promise<void>;
  deleteAssets(ids: string[]): Promise<void>;
  syncAssets(onProgress?: (message: string) => void): Promise<void>;
}
