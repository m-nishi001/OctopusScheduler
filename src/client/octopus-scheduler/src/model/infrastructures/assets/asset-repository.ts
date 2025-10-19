import { injectable } from "tsyringe";
import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IAssetRepository } from "../../domains/assets/repository/asset-repository";
import type { Asset } from "../../domains/assets/entity/asset";
import type { DriveData } from "@octopus/server-common/drive-types";

@injectable()
export class AssetRepository implements IAssetRepository {
  private readonly localStorage: LocalStorageService;

  constructor() {
    // store domain Assets locally under store name "Asset"
    this.localStorage = new LocalStorageService("octopus-scheduler", "Asset");
  }

  private driveDataToAsset(d: DriveData): Asset {
    return {
      id: d.metadata?.driveDataId || crypto.randomUUID(),
      type: d.fileKind?.startsWith("image")
        ? "image"
        : d.fileKind?.startsWith("video")
          ? "video"
          : d.fileKind?.startsWith("audio")
            ? "audio"
            : "text",
      dataUrl: d.fileDataUrl,
      name: d.fileName,
      uploadedAt: d.uploadDate
        ? d.uploadDate.toISOString()
        : new Date().toISOString(),
      lastUpdated: d.metadata?.lastUpdate
        ? d.metadata.lastUpdate.toISOString()
        : new Date().toISOString(),
      size: d.metadata?.size || 0,
      directoryId: d.metadata?.parentFolderId || undefined,
    };
  }

  async addAssets(assets: Asset[]): Promise<string[]> {
    const ids: string[] = [];
    for (const asset of assets) {
      const id = asset.id || crypto.randomUUID();
      const assetWithId: Asset = {
        ...asset,
        id,
      };
      await this.localStorage.save(id, assetWithId);
      ids.push(id);
    }
    return ids;
  }

  async getAssets(): Promise<Asset[]> {
    const all = await this.localStorage.getAll<any>();
    const results: Asset[] = [];
    for (const v of Array.from(all.values())) {
      // migrate older DriveData shape if necessary
      if (v && v.fileDataUrl && v.metadata) {
        results.push(this.driveDataToAsset(v as DriveData));
      } else {
        results.push(v as Asset);
      }
    }
    return results;
  }

  async getAssetById(id: string): Promise<Asset | null> {
    const v = await this.localStorage.get<any>(id);
    if (!v) return null;
    if (v && v.fileDataUrl && v.metadata) {
      return this.driveDataToAsset(v as DriveData);
    }
    return v as Asset;
  }

  async deleteAssets(ids: string[]): Promise<void> {
    await this.localStorage.removeMultiple(ids);
  }

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    console.info("syncAssets: not implemented (GAS calls removed)");
    onProgress?.("syncAssets: not implemented (GAS calls removed)");
    return Promise.resolve();
  }
}
