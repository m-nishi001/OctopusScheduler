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

const ASSET_CACHE_KEY = "assets";

@injectable()
export class AssetRepository implements IAssetRepository {
  private readonly gasService =
    GasFunctionService.create("callJackpotGameApi")!;
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("AssetData")
  );

  // ヘルパー関数: API呼び出しとキャッシュ更新の共通処理
  private async callAssetApi(
    method: string,
    asset: Asset,
    onSuccess: (res: { asset: Asset }) => Promise<void>
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.gasService
        .createCall<{ asset: Asset }>(method, { asset })
        .withSuccessed(async (res: { asset: Asset }) => {
          await onSuccess(res);
          resolve(res.asset.id);
        })
        .withTimeout(120000)
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async addAssets(assets: Asset[]): Promise<string[]> {
    if (!this.gasService) throw new Error("GAS service not available");
    const promises = assets.map(async (asset) => {
      if (asset.id) {
        // 既存アセット更新
        return this.callAssetApi(
          "AssetService.updateAsset",
          asset,
          async (res) => {
            const cached =
              (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
            const index = cached.findIndex((a) => a.id === asset.id);
            if (index !== -1) {
              cached[index] = res.asset;
              await this.localStorage.save(ASSET_CACHE_KEY, cached);
            }
          }
        );
      } else {
        // 新規アセット追加
        return this.callAssetApi(
          "AssetService.addAsset",
          asset,
          async (res) => {
            const cached =
              (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
            cached.push(res.asset);
            await this.localStorage.save(ASSET_CACHE_KEY, cached);
          }
        );
      }
    });
    return await Promise.all(promises);
  }

  async getAssets(): Promise<Asset[]> {
    return (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
  }

  async getAssetById(id: string): Promise<Asset | null> {
    const assets =
      (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
    return assets.find((a) => a.id === id) || null;
  }

  async deleteAssets(ids: string[]): Promise<void> {
    const cached =
      (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
    const updated = cached.filter((a) => !ids.includes(a.id));
    await this.localStorage.save(ASSET_CACHE_KEY, updated);
    if (!this.gasService) return;
    const promises = ids.map(
      (id) =>
        new Promise<void>((resolve, reject) => {
          this.gasService
            .createCall<void>("AssetService.deleteAsset", { assetId: id })
            .withSuccessed(() => resolve())
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        })
    );
    await Promise.all(promises);
  }

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    if (!this.gasService) throw new Error("GAS service not available");
    onProgress?.("Google Driveからアセットメタデータを取得中...");
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ metadata: AssetMetadata[] }>(
          "AssetService.getAllAssetMetadata"
        )
        .withTimeout(15000)
        .withSuccessed(async (res: { metadata: AssetMetadata[] }) => {
          onProgress?.("ローカルストレージと比較中...");
          const localAssets = await this.getAssets();
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
            await this.localStorage.save(
              ASSET_CACHE_KEY,
              localAssets.filter((a) => serverIds.has(a.id))
            );
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
                this.gasService!.createCall<{ asset: Asset | null }>(
                  "AssetService.getAsset",
                  { assetId: meta.id }
                )
                  .withTimeout(120000)
                  .withSuccessed(async (assetRes: { asset: Asset | null }) => {
                    if (assetRes.asset) {
                      const cached =
                        (await this.localStorage.get<Asset[]>(
                          ASSET_CACHE_KEY
                        )) || [];
                      const index = cached.findIndex(
                        (a) => a.id === assetRes.asset!.id
                      );
                      if (index !== -1) {
                        cached[index] = assetRes.asset;
                      } else {
                        cached.push(assetRes.asset);
                      }
                      await this.localStorage.save(ASSET_CACHE_KEY, cached);
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
