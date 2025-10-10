import { Asset } from "../entity/asset";
import { AssetMetadata } from "../vo/asset-metadata";

export interface IAssetRepository {
  add(asset: Asset): string;
  findById(assetId: string): Asset | null;
  findAll(): Asset[];
  getAllMetadatas(): AssetMetadata[];
  update(asset: Asset): void;
  delete(assetId: string): void;
}
