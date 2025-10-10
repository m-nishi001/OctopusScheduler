import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { injectable } from "tsyringe";
import type { Asset } from "../../domains/asset/asset";
import type { AssetMetadataDto } from "../../applications/asset/dto/asset-dto";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import type { IAssetRepository } from "../../domains/asset/repository/IAssetRepository";

const ASSET_CACHE_KEY = "assets";

@injectable()
export class AssetRepository implements IAssetRepository {
  private readonly gasService =
    GasFunctionService.create("callJackpotGameApi")!;
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("AssetData")
  );

  async getAssetById(assetId: string): Promise<Asset | undefined> {
    const assets = await this.getAllAssets();
    return assets.find((a) => a.id === assetId);
  }

  async getAllAssets(): Promise<Asset[]> {
    return (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
  }

  async addAsset(asset: Asset): Promise<void> {
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ asset: Asset }>("AssetService.addAsset", asset)
        .withSuccessed((res: { asset: Asset }) => {
          this.localStorage.get<Asset[]>(ASSET_CACHE_KEY).then((assets) => {
            const updated = assets ? [...assets, res.asset] : [res.asset];
            this.localStorage
              .save(ASSET_CACHE_KEY, updated)
              .then(() => resolve());
          });
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async addAssets(
    assets: Asset[],
    onProgress?: (index: number, success: boolean) => void
  ): Promise<{ successful: Asset[]; failed: Asset[] }> {
    const { successful, failed } = await this.performBatchApiCalls(
      assets,
      onProgress
    );
    await this.updateLocalStorageAfterBatch(successful);
    return { successful, failed };
  }

  private async performBatchApiCalls(
    assets: Asset[],
    onProgress?: (index: number, success: boolean) => void
  ): Promise<{ successful: Asset[]; failed: Asset[] }> {
    if (!this.gasService) return { successful: [], failed: [] };
    const calls = assets.map((asset) => {
      const method = asset.id
        ? "AssetService.updateAsset"
        : "AssetService.addAsset";
      return this.gasService!.createCall<{ asset: Asset }>(
        method,
        asset
      ).withTimeout(120000);
    });
    const promises = calls.map((call, index) => {
      return new Promise<{ index: number; success: Asset | false }>(
        (resolve) => {
          call
            .withSuccessed((res: { asset: Asset }) => {
              onProgress?.(index, true);
              resolve({ index, success: res.asset });
            })
            .withFailuered(() => {
              onProgress?.(index, false);
              resolve({ index, success: false });
            })
            .invoke();
        }
      );
    });
    const results = await Promise.all(promises);
    const successful: Asset[] = [];
    const failed: Asset[] = [];
    results.forEach(({ index, success }) => {
      if (success) {
        successful.push(success);
      } else {
        failed.push(assets[index]);
      }
    });
    return { successful, failed };
  }

  private async updateLocalStorageAfterBatch(
    successful: Asset[]
  ): Promise<void> {
    if (successful.length === 0) return;
    const current =
      (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
    let updated = [...current];
    successful.forEach((asset) => {
      const existingIndex = updated.findIndex((a) => a.id === asset.id);
      if (existingIndex >= 0) {
        updated[existingIndex] = asset;
      } else {
        updated.push(asset);
      }
    });
    await this.localStorage.save(ASSET_CACHE_KEY, updated);
  }

  async deleteAssets(assetIds: string[]): Promise<void> {
    if (!this.gasService) return;
    const promises = assetIds.map(
      (assetId) =>
        new Promise<void>((resolve, reject) => {
          this.gasService!.createCall<void>("AssetService.deleteAsset", {
            assetId,
          })
            .withSuccessed(() => resolve())
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        })
    );
    await Promise.all(promises);
    // 全てのサーバー削除が成功したら、ローカルストレージを更新
    let assets = (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
    assets = assets.filter((a: Asset) => !assetIds.includes(a.id));
    await this.localStorage.save(ASSET_CACHE_KEY, assets);
  }

  async syncAssets(onProgress?: (message: string) => void): Promise<void> {
    if (!this.gasService) return;
    const serverAssetsInfo = await this.fetchAssetMetadata(onProgress);
    const localAssets = await this.getAllAssets();
    const { toAdd, toUpdate, toDelete } = this.determineSyncChanges(
      localAssets,
      serverAssetsInfo
    );
    const newAssets = await this.downloadAssets(
      [...toAdd, ...toUpdate],
      onProgress
    );
    await this.updateLocalStorageAfterSync(toDelete, newAssets, localAssets);
    onProgress?.("同期完了");
  }

  private async fetchAssetMetadata(
    onProgress?: (message: string) => void
  ): Promise<AssetMetadataDto[]> {
    return new Promise((resolve, reject) => {
      this.gasService!.createCall<{ assets: AssetMetadataDto[] }>(
        "AssetService.getAssetMetadata"
      )
        .withTimeout(120000)
        .withSuccessed((res: { assets: AssetMetadataDto[] }) => {
          onProgress?.("メタデータ取得完了");
          resolve(res.assets);
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  private determineSyncChanges(
    localAssets: Asset[],
    serverAssets: AssetMetadataDto[]
  ): { toAdd: string[]; toUpdate: string[]; toDelete: string[] } {
    const localAssetsMap = new Map(localAssets.map((a) => [a.id, a]));
    const serverAssetsMap = new Map(serverAssets.map((a) => [a.id, a]));
    const toAdd: string[] = [];
    const toUpdate: string[] = [];
    const toDelete: string[] = [];
    for (const serverAsset of serverAssets) {
      if (!localAssetsMap.has(serverAsset.id)) {
        toAdd.push(serverAsset.id);
      } else {
        const localAsset = localAssetsMap.get(serverAsset.id)!;
        if (
          new Date(localAsset.lastUpdated) < new Date(serverAsset.lastUpdated)
        ) {
          toUpdate.push(serverAsset.id);
        }
      }
    }
    for (const localAsset of localAssets) {
      if (!serverAssetsMap.has(localAsset.id)) {
        toDelete.push(localAsset.id);
      }
    }
    return { toAdd, toUpdate, toDelete };
  }

  private async downloadAssets(
    ids: string[],
    onProgress?: (message: string) => void
  ): Promise<Asset[]> {
    if (ids.length === 0) return [];
    onProgress?.(`ファイルダウンロード中 (${ids.length}件)`);
    const assetPromises = ids.map(
      (id) =>
        new Promise<Asset | null>((resolve) => {
          this.gasService!.createCall<{ asset: Asset | null }>(
            "AssetService.getAssetById",
            { assetId: id }
          )
            .withTimeout(120000)
            .withSuccessed((res: { asset: Asset | null }) => {
              const asset = res.asset;
              if (asset) {
                onProgress?.(
                  `${asset.name} (${(asset.size / 1024).toFixed(1)}KB): ダウンロード中`
                );
              }
              resolve(asset);
            })
            .withFailuered(() => resolve(null))
            .invoke();
        })
    );
    const newOrUpdatedAssets = await Promise.all(assetPromises);
    return newOrUpdatedAssets.filter(
      (a): a is Asset => !!a && a.id !== undefined && a.id !== null
    );
  }

  private async updateLocalStorageAfterSync(
    toDelete: string[],
    newAssets: Asset[],
    localAssets: Asset[]
  ): Promise<void> {
    let updatedLocalAssets = localAssets.filter(
      (a) => !toDelete.includes(a.id)
    );
    updatedLocalAssets = updatedLocalAssets.filter(
      (a) => !newAssets.some((na) => na.id === a.id)
    );
    updatedLocalAssets = [...updatedLocalAssets, ...newAssets];
    await this.localStorage.save(ASSET_CACHE_KEY, updatedLocalAssets);
  }
}
