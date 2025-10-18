import type { DriveData } from "@octopus/server-common/drive-types";

export type AssetMetadata = DriveData;

export interface IAssetRepository {
  addAssets(
    assets: DriveData[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<string[]>;
  getAssets(): Promise<DriveData[]>;
  getAssetById(id: string): Promise<DriveData | null>;
  deleteAssets(ids: string[]): Promise<void>;
  syncAssets(onProgress?: (message: string) => void): Promise<void>;
  getAllAssetMetadata(): Promise<DriveData[]>;
}
