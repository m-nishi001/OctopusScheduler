import type { Asset } from "../asset";

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
}
