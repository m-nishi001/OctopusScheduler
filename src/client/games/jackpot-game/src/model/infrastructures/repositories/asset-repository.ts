import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { injectable } from "tsyringe";
import type { Asset } from "../../domains/asset/asset";
import { AssetDto } from "../../applications/asset/dto/asset-dto";
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

  async addAssets(assets: Asset[]): Promise<string[]> {
    if (!this.gasService) throw new Error("GAS service not available");
    const promises = assets.map(async (asset) => {
      if (asset.id) {
        // Update existing asset
        return new Promise<string>((resolve, reject) => {
          this.gasService
            .createCall<{ asset: Asset }>("AssetService.updateAsset", asset)
            .withSuccessed(async (res: { asset: Asset }) => {
              const cached =
                (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
              const index = cached.findIndex((a) => a.id === asset.id);
              if (index !== -1) {
                cached[index] = res.asset;
                await this.localStorage.save(ASSET_CACHE_KEY, cached);
              }
              resolve(res.asset.id);
            })
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        });
      } else {
        // Upload new asset
        return new Promise<string>((resolve, reject) => {
          this.gasService
            .createCall<{ asset: Asset }>("AssetService.addAsset", asset)
            .withSuccessed(async (res: { asset: Asset }) => {
              const cached =
                (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
              cached.push(res.asset);
              await this.localStorage.save(ASSET_CACHE_KEY, cached);
              resolve(res.asset.id);
            })
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        });
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
    onProgress?.("Google Driveからアセット情報を取得中...");
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ assets: AssetDto[] }>("AssetService.getAssets")
        .withSuccessed(async (res: { assets: AssetDto[] }) => {
          onProgress?.("IndexedDBに同期中...");
          const serverAssets = await Promise.all(
            res.assets.map((dto) => dto.toAsset())
          );
          await this.localStorage.save(ASSET_CACHE_KEY, serverAssets);
          onProgress?.("同期完了");
          resolve();
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }
}
