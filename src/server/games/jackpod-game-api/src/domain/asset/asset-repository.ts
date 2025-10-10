import { Asset } from "./asset";
import { AssetMetadataDto } from "../../applications/asset/asset-dto";

export interface IAssetRepository {
  uploadAsset(asset: Asset): Promise<string>;
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
}
