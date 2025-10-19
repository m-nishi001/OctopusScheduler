import type { DriveData } from "@octopus/server-common/drive-types";

export interface IAssetRepository {
  addAssets(assets: DriveData[]): Promise<string[]>;
  getAssets(): Promise<DriveData[]>;
  getAssetById(id: string): Promise<DriveData | null>;
  deleteAssets(ids: string[]): Promise<void>;
  syncAssets(onProgress?: (message: string) => void): Promise<void>;
}
