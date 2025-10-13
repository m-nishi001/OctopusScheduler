import { Asset } from "./asset";

export type AssetMetadata = {
  id: string;
  type: "image" | "video" | "audio" | "text";
  name: string;
  uploadedAt: string;
  lastUpdated: string;
  size: number;
};

export interface IAssetRepository {
  addAssets(assets: Asset[]): string[];
  getAllAssets(): Asset[];
  getAssetById(id: string): Asset | null;
  getAllAssetMetadata(): AssetMetadata[];
  deleteAssets(ids: string[]): void;
  registerRef(assetId: string, refSourceId: string): void;
  unregisterRef(assetId: string, refSourceId: string): void;
}
