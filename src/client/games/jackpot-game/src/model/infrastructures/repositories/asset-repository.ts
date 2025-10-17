import { injectable } from "tsyringe";
import type { Asset } from "../../domains/asset/asset";
import { LocalStorageService } from "../../../../../../packages/common-lib/src/storage/local-storage-service";
import { StorageConfig } from "../../infrastructures/storage-config";
import type {
  IAssetRepository,
  AssetMetadata,
} from "../../domains/asset/repository/i-asset-repository";

declare const google: any;

@injectable()
export class AssetRepository implements IAssetRepository {
  private readonly localStorage: LocalStorageService;

  constructor() {
    this.localStorage = new LocalStorageService(
      StorageConfig.getDbName(),
      StorageConfig.getStoreName("AssetData")
    );
  }

  async addAssets(
    assets: Asset[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const [index, asset] of assets.entries()) {
      const id = crypto.randomUUID();
      const assetWithId: Asset = { ...asset, id };
      await this.localStorage.save(id, assetWithId);
      ids.push(id);
      onProgress?.(index, "完了");
    }
    return ids;
  }

  async getAssets(): Promise<Asset[]> {
    const allAssets = await this.localStorage.getAll<Asset>();
    return Array.from(allAssets.values());
  }

  async getAssetById(id: string): Promise<Asset | null> {
    return (await this.localStorage.get<Asset>(id)) || null;
  }

  async deleteAssets(ids: string[]): Promise<void> {
    await this.localStorage.removeMultiple(ids);
  }

  async syncAssets(
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }> {
    onProgress?.("同期完了");
    return { updated: 0, deleted: 0 };
  }

  async getAllAssetMetadata(): Promise<AssetMetadata[]> {
    const assets = await this.getAssets();
    return assets.map((asset) => ({
      id: asset.id,
      type: asset.type,
      name: asset.name,
      uploadedAt: asset.uploadedAt,
      lastUpdated: asset.lastUpdated,
      size: asset.size,
    }));
  }
}
