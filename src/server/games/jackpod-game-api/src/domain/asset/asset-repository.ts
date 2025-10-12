import { Asset } from "./asset";
import { AssetMetadataDto } from "../../applications/asset/asset-dto";

export interface IAssetRepository {
  addAssets(assets: Asset[]): string[];
  getAllAssets(): Asset[];
  getAssetById(id: string): Asset | null;
  getAllAssetMetadata(): AssetMetadataDto[];
  deleteAssets(ids: string[]): void;
  registerRef(assetId: string, refSourceId: string): void;
  unregisterRef(assetId: string, refSourceId: string): void;
}
