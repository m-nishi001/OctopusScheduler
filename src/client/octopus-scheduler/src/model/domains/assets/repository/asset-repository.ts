import type { Asset } from "../entity/assset";

export interface IAssetRepository {
  add(asset: Asset): Promise<void>;
  sync(): Promise<void>;
  findById(assetId: string): Promise<Asset | null>;
  findAll(): Promise<Asset[]>;
  delete(assetId: string): Promise<void>;
}
