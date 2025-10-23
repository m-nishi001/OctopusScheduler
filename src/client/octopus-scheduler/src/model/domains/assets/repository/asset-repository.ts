import type { Asset } from "../entity/asset";

export interface IAssetRepository {
  addAssets(assets: Asset[]): Promise<string[]>;
  getAssets(): Promise<Asset[]>;
  getAssetById(id: string): Promise<Asset | null>;
  deleteAssets(ids: string[]): Promise<void>;
  syncAssets(onProgress?: (message: string) => void): Promise<void>;
}

export const IAssetRepositoryToken = Symbol("IAssetRepository");
