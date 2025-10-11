import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { injectable } from "tsyringe";
import type { Asset } from "../../domains/asset/asset";
import { AssetMetadataDto } from "../../applications/asset/dto/asset-dto";
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

  async uploadAsset(asset: Asset): Promise<string> {
    if (!this.gasService) throw new Error("GAS service not available");
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ asset: Asset }>("AssetService.addAsset", asset)
        .withSuccessed((res: { asset: Asset }) => {
          this.localStorage.get<Asset[]>(ASSET_CACHE_KEY).then((assets) => {
            const updated = assets ? [...assets, res.asset] : [res.asset];
            this.localStorage
              .save(ASSET_CACHE_KEY, updated)
              .then(() => resolve(res.asset.id));
          });
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async getAsset(id: string): Promise<Asset | null> {
    const assets =
      (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
    return assets.find((a) => a.id === id) || null;
  }

  async findAll(): Promise<Asset[]> {
    return (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
  }

  async findAllIds(): Promise<string[]> {
    const assets = await this.findAll();
    return assets.map((a) => a.id);
  }

  async findAllMetadata(): Promise<AssetMetadataDto[]> {
    const assets = await this.findAll();
    return assets.map(
      (a) =>
        new AssetMetadataDto(
          a.id,
          a.type,
          a.name,
          a.uploadedAt,
          a.lastUpdated,
          a.size
        )
    );
  }

  async updateAsset(
    id: string,
    updateFn: (asset: Asset) => Asset
  ): Promise<string> {
    const assets = await this.findAll();
    const index = assets.findIndex((a) => a.id === id);
    if (index === -1) throw new Error("Asset not found");
    const updated = updateFn(assets[index]);
    assets[index] = updated;
    await this.localStorage.save(ASSET_CACHE_KEY, assets);
    if (!this.gasService) return updated.id;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ asset: Asset }>("AssetService.updateAsset", updated)
        .withSuccessed(() => resolve(updated.id))
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async updateManyAssets(
    ids: string[],
    updateFn: (asset: Asset) => Asset
  ): Promise<string[]> {
    const promises = ids.map((id) => this.updateAsset(id, updateFn));
    return await Promise.all(promises);
  }

  async deleteAsset(id: string): Promise<void> {
    const assets = await this.findAll();
    const updated = assets.filter((a) => a.id !== id);
    await this.localStorage.save(ASSET_CACHE_KEY, updated);
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("AssetService.deleteAsset", { assetId: id })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async uploadAssets(
    assets: Asset[],
    onProgress?: (index: number, success: boolean) => void
  ): Promise<{ successful: Asset[]; failed: Asset[] }> {
    if (!this.gasService) throw new Error("GAS service not available");
    const promises = assets.map(async (asset, index) => {
      try {
        const id = await this.uploadAsset(asset);
        onProgress?.(index, true);
        return { ...asset, id };
      } catch (e) {
        onProgress?.(index, false);
        return null;
      }
    });
    const results = await Promise.all(promises);
    const successful = results.filter((r): r is Asset => r !== null);
    const failed = assets.filter((_, index) => results[index] === null);
    return { successful, failed };
  }

  async deleteAssets(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => this.deleteAsset(id)));
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
