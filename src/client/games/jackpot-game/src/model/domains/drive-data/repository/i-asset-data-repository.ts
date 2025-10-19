import type {
  Asset,
  AssetMetadata,
} from "../../../applications/asset/dto/asset-data";

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
  getAllAssetDataMetadata(): Promise<AssetMetadata[]>;
}
