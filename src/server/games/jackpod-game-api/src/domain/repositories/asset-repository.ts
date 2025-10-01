import { Asset } from "../entities/asset";

export interface IAssetRepository {
  uploadAsset(asset: Asset): string;
  getAsset(id: string): Asset | null;
  findAll(): Asset[];
  findAllIds(): string[];
  updateAsset(id: string, updateAsset: (asset: Asset) => Asset): string;
  updateManyAssets(
    ids: string[],
    updateAsset: (asset: Asset) => Asset
  ): string[];
}
