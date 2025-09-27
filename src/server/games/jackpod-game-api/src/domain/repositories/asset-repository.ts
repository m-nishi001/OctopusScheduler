import { Asset } from '../entities/asset';

export interface AssetRepository {
  uploadAsset(asset: Asset): Promise<string>;
  getAsset(id: string): Promise<Asset | null>;
  updateAsset(id: string, updateAsset: (asset: Asset) => Asset): Promise<string>;
  updateManyAssets(ids: string[], updateAsset: (asset: Asset) => Asset): Promise<string[]>;
}
