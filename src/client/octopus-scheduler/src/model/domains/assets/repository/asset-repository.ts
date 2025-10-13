import type { Asset } from "../entity/asset";

export type AssetMetadata = {
  id: string;
  type: "image" | "video" | "audio" | "text";
  name: string;
  uploadedAt: string;
  lastUpdated: string;
  size: number;
};

export interface IAssetRepository {
  addAssets(
    assets: Asset[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<string[]>;
  getAssets(): Promise<Asset[]>;
  getAssetById(id: string): Promise<Asset | null>;
  deleteAssets(ids: string[]): Promise<void>;
  syncAssets(onProgress?: (message: string) => void): Promise<void>;
  getAllAssetMetadata(): Promise<AssetMetadata[]>;
  registerRef(assetId: string, refSourceId: string): Promise<void>;
  unregisterRef(assetId: string, refSourceId: string): Promise<void>;
}
