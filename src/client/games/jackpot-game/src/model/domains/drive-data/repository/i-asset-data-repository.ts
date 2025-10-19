import type {
  AssetDataDto,
  AssetMetadataDto,
} from "../../../applications/asset/dto/asset-data-dto";

export interface IAssetDataRepository {
  addAssetData(assetData: AssetDataDto[]): Promise<AssetDataDto[]>;
  getAssetData(): Promise<AssetDataDto[]>;
  getAssetDataById(id: string): Promise<AssetDataDto | null>;
  deleteAssetData(ids: string[]): Promise<void>;
  syncAssetData(
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }>;
  getAllAssetDataMetadata(): Promise<AssetMetadataDto[]>;
}
