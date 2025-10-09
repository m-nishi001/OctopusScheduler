import type { IAssetRepository } from "../../domains/assets/repository/asset-repository";
import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service.ts";
import { GasFunctionService } from "../../../../../packages/common-lib/src/google-apps-script/gas-script-service.ts";
import { Asset } from "../../domains/assets/entity/assset.ts";
import { StorageConfig } from "../storage-config.ts";
import { injectable } from "tsyringe";

@injectable()
export class AssetRepository implements IAssetRepository {
  private readonly service;
  private readonly assetStorage: LocalStorageService;

  constructor() {
    const apiName = "callOctopusSchedulerApi";
    this.service = GasFunctionService.create(apiName)!;
    this.assetStorage = new LocalStorageService(
      StorageConfig.getDbName(),
      "AssetData"
    );
  }

  async add(asset: Asset): Promise<void> {
    try {
      const serialized = await asset.serializeForServer();

      console.log(`Uploading asset to remote:`, serialized);
      console.log(`${JSON.stringify(serialized)}`);

      let assetId: string = "";
      await this.service
        .createCall<{ assetId: string }>("AssetService.addAsset", serialized)
        .withTimeout(60000)
        .withSuccessed(({ assetId: returnedId }) => (assetId = returnedId))
        .withFailuered((message) => {
          console.error(`Failed to save asset to remote:`, message);
          throw new Error("Failed to save asset to remote.");
        })
        .invoke();

      // assetIdを設定するために再生成する
      const reCreated = Asset.create(
        asset.assetType,
        asset.assetName,
        asset.assetData,
        assetId,
        asset.updatedAt
      );
      await this.assetStorage.save<Asset>(assetId, reCreated.serialize());
    } catch (error) {
      console.error(`Failed to save asset with ID ${asset.assetId}:`, error);
      throw new Error("Failed to save asset.");
    }
  }

  async findById(assetId: string): Promise<Asset | null> {
    const asset = await this.assetStorage.get<Asset>(assetId);
    return asset ? Asset.from(asset) : null;
  }

  async findAll(): Promise<Asset[]> {
    const assets = await this.assetStorage.getAll<Asset>();

    if (!assets || assets.size === 0) return [];

    return Array.from(assets.values())
      .map((obj) => Asset.from(obj))
      .filter((asset) => asset !== null) as Asset[];
  }

  async delete(assetId: string): Promise<void> {
    try {
      // First request remote deletion
      await this.service
        .createCall<void>("AssetService.deleteAsset", assetId)
        .withTimeout(10000)
        .withSuccessed(() =>
          console.log(`Asset with ID ${assetId} deleted on remote.`)
        )
        .withFailuered((message) => {
          console.error(`Failed to delete asset on remote:`, message);
          throw new Error("Failed to delete asset on remote.");
        })
        .invoke();

      // On success, remove local data
      await this.assetStorage.delete(assetId);

      console.log(
        `Asset with ID ${assetId} deleted successfully (remote + local).`
      );
    } catch (error) {
      console.error(`Failed to delete asset with ID ${assetId}:`, error);
      throw new Error("Failed to delete asset.");
    }
  }

  async sync(): Promise<void> {
    try {
      const remoteMetadatas = await this.getRemoteMetadatas();
      if (remoteMetadatas.length === 0) {
        console.log("No remote asset metadata found. Sync skipped.");
        return;
      }

      const localAssets = await this.assetStorage.getAll<Asset>();

      const deletingIds = Array.from(localAssets.values())
        .filter(
          (localAsset) =>
            !remoteMetadatas.some(
              (remoteMetadata) => remoteMetadata.assetId === localAsset.assetId
            )
        )
        .map((localAsset) => localAsset.assetId);
      if (deletingIds.length > 0)
        await this.assetStorage.removeMultiple(deletingIds);

      const needsFetchIds = remoteMetadatas
        .filter((remoteMetadata) => !localAssets.has(remoteMetadata.assetId))
        .map((remoteMetadata) => remoteMetadata.assetId);
      if (needsFetchIds.length > 0) {
        const fetchedAssets = await this.fetchAssetDatas(needsFetchIds);
        const assetsToSave = new Map(
          fetchedAssets.map((asset) => [asset.assetId, asset.serialize()])
        );
        await this.assetStorage.saveMultiple<Asset>(assetsToSave);
      }

      console.log(
        `Sync completed. Deleted ${deletingIds.length} assets, fetched ${needsFetchIds.length} new assets.`
      );
    } catch (error) {
      console.error("An error occurred during sync:", error);
      throw new Error("Failed to sync audios.");
    }
  }

  private async getRemoteMetadatas(): Promise<
    { assetId: string; updatedAt: Date }[]
  > {
    return new Promise((resolve, reject) => {
      this.service
        .createCall<{ assetId: string; updatedAt: string }[]>(
          "AssetService.getAllMetadatas"
        )
        .withTimeout(60000)
        .withSuccessed((metadatas) => {
          resolve(
            metadatas.map((metadata) => ({
              assetId: metadata.assetId,
              updatedAt: new Date(metadata.updatedAt),
            }))
          );
        })
        .withFailuered((message) => {
          console.error("Failed to get remote asset metadata:", message);
          reject(new Error(message));
        })
        .invoke();
    });
  }

  private async fetchAssetDatas(assetIds: string[]): Promise<Asset[]> {
    const assets: Asset[] = [];
    const promises = assetIds.map((assetId) =>
      this.service
        .createCall<Asset>("AssetService.getAssetById", assetId)
        .withTimeout(60000)
        .withSuccessed((asset) => {
          if (asset) assets.push(asset);
        })
        .withFailuered((message) =>
          console.error("Failed to fetch asset data:", message)
        )
    );
    await this.service.all<Asset>(...promises);

    const deserializeds = await Promise.all(assets.map(Asset.fromServer));
    return deserializeds.filter((asset) => asset !== null);
  }
}
