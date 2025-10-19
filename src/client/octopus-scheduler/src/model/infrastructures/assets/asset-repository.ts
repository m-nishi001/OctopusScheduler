import { injectable } from "tsyringe";
import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IAssetRepository } from "../../domains/assets/repository/asset-repository";
import type { Asset } from "../../domains/assets/entity/asset";
import type { DriveData } from "@octopus/server-common/drive-types";

@injectable()
export class AssetRepository implements IAssetRepository {
  private readonly localStorage: LocalStorageService;

  constructor() {
    this.localStorage = new LocalStorageService("octopus-scheduler", "Asset");
  }

  private async driveDataToAsset(d: DriveData): Promise<Asset> {
    const asset: Asset = {
      id: d.metadata?.driveDataId || crypto.randomUUID(),
      // initially set an empty Blob; replaced below when fetch succeeds
      blob: new Blob(),
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

    try {
      const res = await fetch(d.fileDataUrl);
      asset.blob = await res.blob();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Failed to convert DriveData.fileDataUrl to Blob", e);
    }

    return asset;
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
        results.push(await this.driveDataToAsset(v as DriveData));
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
      return await this.driveDataToAsset(v as DriveData);
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
