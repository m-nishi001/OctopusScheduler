import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { injectable } from "tsyringe";
import type { Asset } from "../../domains/asset/asset";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import type { IAssetRepository } from "../../domains/asset/repository/IAssetRepository";
import { FileUtils } from "../../infrastructures/utils/file-utils";

interface AssetMetadata {
  id: string;
  type: "image" | "video" | "audio" | "text";
  name: string;
  uploadedAt: string;
  lastUpdated: string;
  size: number;
}

@injectable()
export class AssetRepository implements IAssetRepository {
  private readonly localStorage: ReturnType<typeof useLocalStorage>;
  private readonly synchronizer: AssetSynchronizer;

  constructor() {
    this.localStorage = useLocalStorage(
      StorageConfig.getDbName(),
      StorageConfig.getStoreName("AssetData")
    );
    this.synchronizer = new AssetSynchronizer(this.localStorage);
  }

  async addAssets(assets: Asset[]): Promise<string[]> {
    const gasService = GasFunctionService.create("callJackpotGameApi");
    if (!gasService) throw new Error("GAS service not available");
    const promises = assets.map(async (asset) => {
      const method = asset.id
        ? "AssetService.updateAsset"
        : "AssetService.addAsset";
      return new Promise<string>((resolve, reject) => {
        gasService
          .createCall<{ asset: Asset }>(method, { asset })
          .withSuccessed(async (res: { asset: Asset }) => {
            await this.localStorage.save(res.asset.id, res.asset);
            resolve(res.asset.id);
          })
          .withTimeout(120000)
          .withFailuered((msg: string) => reject(new Error(msg)))
          .invoke();
      });
    });
    return await Promise.all(promises);
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
    const gasService = GasFunctionService.create("callJackpotGameApi");
    if (!gasService) return;
    const promises = ids.map(
      (id) =>
        new Promise<void>((resolve, reject) => {
          gasService
            .createCall<void>("AssetService.deleteAsset", { assetId: id })
            .withSuccessed(() => resolve())
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        })
    );
    await Promise.all(promises);
  }

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    return this.synchronizer.syncAssets(onProgress);
  }
}

class AssetSynchronizer {
  constructor(
    private readonly localStorage: ReturnType<typeof useLocalStorage>
  ) {}

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    const gasService = GasFunctionService.create("callJackpotGameApi");
    if (!gasService) throw new Error("GAS service not available");
    onProgress?.("Google Driveからアセットメタデータを取得中...");
    return new Promise((resolve, reject) => {
      gasService
        .createCall<{ metadata: AssetMetadata[] }>(
          "AssetService.getAllAssetMetadata"
        )
        .withTimeout(15000)
        .withSuccessed(async (res: { metadata: AssetMetadata[] }) => {
          onProgress?.("ローカルストレージと比較中...");
          const allLocalAssets = await this.localStorage.getAll<Asset>();
          const localAssets = Array.from(allLocalAssets.values());
          const serverIds = new Set(res.metadata.map((meta) => meta.id));
          const toUpdate = res.metadata.filter((meta) => {
            const local = localAssets.find((a) => a.id === meta.id);
            return (
              !local || new Date(local.lastUpdated) < new Date(meta.lastUpdated)
            );
          });
          const toDelete = localAssets.filter(
            (local) => !serverIds.has(local.id)
          );
          if (toDelete.length > 0) {
            onProgress?.(`${toDelete.length}個の不要なアセットを削除中...`);
            await this.localStorage.removeMultiple(toDelete.map((a) => a.id));
          }
          if (toUpdate.length === 0) {
            onProgress?.("同期完了");
            resolve();
            return;
          }
          onProgress?.(`${toUpdate.length}個のアセットをダウンロード中...`);
          const downloadPromises = toUpdate.map(
            (meta) =>
              new Promise<void>((resolveDownload, rejectDownload) => {
                onProgress?.(
                  `${meta.name} をダウンロード中... (${FileUtils.formatSize(meta.size)})`
                );
                gasService!
                  .createCall<{ asset: Asset | null }>(
                    "AssetService.getAsset",
                    { assetId: meta.id }
                  )
                  .withTimeout(120000)
                  .withSuccessed(async (assetRes: { asset: Asset | null }) => {
                    if (assetRes.asset) {
                      await this.localStorage.save(
                        assetRes.asset.id,
                        assetRes.asset
                      );
                    }
                    onProgress?.(
                      `${meta.name} ダウンロード完了 (${FileUtils.formatSize(meta.size)})`
                    );
                    resolveDownload();
                  })
                  .withFailuered((msg: string) =>
                    rejectDownload(new Error(msg))
                  )
                  .invoke();
              })
          );
          await Promise.all(downloadPromises);
          onProgress?.("同期完了");
          resolve();
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }
}
