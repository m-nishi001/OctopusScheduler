import { injectable } from "tsyringe";
import type { Asset } from "../../domains/asset/asset";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import type {
  IAssetRepository,
  AssetMetadata,
} from "../../domains/asset/repository/i-asset-repository";

declare const google: any;

@injectable()
export class AssetRepository implements IAssetRepository {
  private readonly localStorage: ReturnType<typeof useLocalStorage>;

  constructor() {
    this.localStorage = useLocalStorage(
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
    return new Promise((resolve, reject) => {
      onProgress?.("Google Driveからアセットメタデータを取得中...");
      (globalThis as any).google.script.run
        .withSuccessHandler((metadata: any[]) => {
          this.handleMetadata(metadata, onProgress).then(resolve).catch(reject);
        })
        .withFailureHandler((error: any) => reject(new Error(error)))
        .getDriveMetaData();
    });
  }

  private async handleMetadata(
    metadata: any[],
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<{ updated: number; deleted: number }> {
    const localAssets = await this.getLocalAssets();
    const { toUpdate, toDelete } = this.compareWithLocal(metadata, localAssets);

    await this.deleteObsoleteAssets(toDelete, onProgress);
    await this.downloadUpdatedAssets(toUpdate, onProgress);

    onProgress?.("同期完了", {
      current: toUpdate.length,
      total: toUpdate.length,
    });
    return { updated: toUpdate.length, deleted: toDelete.length };
  }

  private async getLocalAssets(): Promise<Asset[]> {
    const allLocalAssets = await this.localStorage.getAll<Asset>();
    return Array.from(allLocalAssets.values());
  }

  private compareWithLocal(
    metadata: any[],
    localAssets: Asset[]
  ): {
    toUpdate: any[];
    toDelete: Asset[];
  } {
    const serverIds = new Set(metadata.map((meta) => meta.fileId));
    const toUpdate = metadata.filter((meta) => {
      const local = localAssets.find((a) => a.id === meta.fileId);
      return !local || new Date(local.lastUpdated) < new Date(meta.lastUpdate);
    });
    const toDelete = localAssets.filter((local) => !serverIds.has(local.id));
    return { toUpdate, toDelete };
  }

  private async deleteObsoleteAssets(
    toDelete: Asset[],
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<void> {
    if (toDelete.length > 0) {
      onProgress?.(`${toDelete.length}個の不要なアセットを削除中...`);
      await this.localStorage.removeMultiple(toDelete.map((a) => a.id));
    }
  }

  private async downloadUpdatedAssets(
    toUpdate: any[],
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void
  ): Promise<void> {
    if (toUpdate.length === 0) return;

    onProgress?.(`${toUpdate.length}個のアセットをダウンロード中...`, {
      current: 0,
      total: toUpdate.length,
    });
    let completed = 0;
    const downloadPromises = toUpdate.map((meta) =>
      this.downloadAsset(meta, onProgress, () => {
        completed++;
        onProgress?.(`${toUpdate.length}個のアセットをダウンロード中...`, {
          current: completed,
          total: toUpdate.length,
        });
      })
    );
    await Promise.all(downloadPromises);
  }

  private async downloadAsset(
    meta: any,
    onProgress?: (
      message: string,
      progress?: { current: number; total: number }
    ) => void,
    onComplete?: () => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      onProgress?.(`${meta.fileName} をダウンロード中...`);
      (globalThis as any).google.script.run
        .withSuccessHandler((assetData: any) => {
          if (assetData) {
            const asset: Asset = {
              id: assetData.fileId,
              name: assetData.fileName,
              type: assetData.fileKind.startsWith("image/")
                ? "image"
                : assetData.fileKind.startsWith("audio/")
                  ? "audio"
                  : "video",
              dataUrl: assetData.fileData,
              uploadedAt: assetData.uploadDate,
              lastUpdated: assetData.lastUpdate,
              size: assetData.fileData.length,
              referenceFrom: [],
            };
            this.localStorage.save(asset.id, asset);
          }
          onProgress?.(`${meta.fileName} ダウンロード完了`);
          onComplete?.();
          resolve();
        })
        .withFailureHandler((error: any) => reject(new Error(error)))
        .getDriveData(meta.fileId);
    });
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

  async registerRef(_assetId: string, _refSourceId: string): Promise<void> {
    // No GAS call needed
  }

  async unregisterRef(_assetId: string, _refSourceId: string): Promise<void> {
    // No GAS call needed
  }
}
