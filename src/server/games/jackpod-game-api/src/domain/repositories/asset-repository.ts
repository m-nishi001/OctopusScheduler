import { Asset } from '../entities/asset';

export interface AssetRepository {
  uploadAsset(asset: Asset): string;
  getAsset(id: string): Asset | null;
  updateAsset(id: string, updateAsset: (asset: Asset) => Asset): string;
  updateManyAssets(ids: string[], updateAsset: (asset: Asset) => Asset): string[];
}
