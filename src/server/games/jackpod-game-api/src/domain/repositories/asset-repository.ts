import { Asset } from "../entities/asset";
import { AssetMetadataDto } from "../../application/dtos/asset.dto";

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
}
