import { Asset } from "./asset";
import { AssetMetadataDto } from "../../applications/asset/asset-dto";

export interface IAssetRepository {
  addAssets(assets: Asset[]): string[];
  getAllAssets(): Asset[];
  getAssetById(id: string): Asset | null;
  getAllAssetMetadata(): AssetMetadataDto[];
  deleteAssets(ids: string[]): void;
}
