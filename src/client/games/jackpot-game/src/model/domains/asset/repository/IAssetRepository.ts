import type { Asset } from "../asset";
import { AssetMetadataDto } from "../../../applications/asset/dto/asset-dto";

export interface IAssetRepository {
  uploadAsset(asset: Asset): string;
  getAsset(id: string): Asset | null;
  findAll(): Asset[];
  findAllIds(): string[];
  findAllMetadata(): AssetMetadataDto[];
  updateAsset(id: string, updateAsset: (asset: Asset) => Asset): string;
  updateManyAssets(
    ids: string[],
    updateAsset: (asset: Asset) => Asset
  ): string[];
  deleteAsset(id: string): void;
}
