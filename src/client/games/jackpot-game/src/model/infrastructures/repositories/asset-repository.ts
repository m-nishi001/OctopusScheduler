import { injectable } from "tsyringe";
import type { Asset } from "../../domains/asset/asset";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import type {
  IAssetRepository,
  AssetMetadata,
} from "../../domains/asset/repository/i-asset-repository";
import { FileUtils } from "../../infrastructures/utils/file-utils";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";

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

  async addAssets(
    assets: Asset[],
    onProgress?: (
      index: number,
      status: "完了" | "失敗",
      message?: string
    ) => void
  ): Promise<string[]> {
    const gasService = GasFunctionService.create("callJackpotGameApi");
    if (!gasService) throw new Error("GAS service not available");
    const promises = assets.map(async (asset, index) => {
      const method = asset.id
        ? "AssetService.updateAsset"
        : "AssetService.addAsset";
      return new Promise<string>((resolve, reject) => {
        gasService
          .createCall<{ asset: Asset }>(method, { asset })
          .withSuccessed(async (res: { asset: Asset }) => {
            await this.localStorage.save(res.asset.id, res.asset);
            onProgress?.(index, "完了");
            resolve(res.asset.id);
          })
          .withTimeout(120000)
          .withFailuered((msg: string) => {
            onProgress?.(index, "失敗", msg);
            reject(new Error(msg));
          })
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
    await this.synchronizer.execute(onProgress);
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

class AssetSynchronizer {
  constructor(
    private readonly localStorage: ReturnType<typeof useLocalStorage>
  ) {}

  async execute(onProgress?: (message: string) => void): Promise<void> {
    const gasService = GasFunctionService.create("callJackpotGameApi");
    if (!gasService) throw new Error("GAS service not available");

    const metadata = await this.fetchMetadata(gasService, onProgress);
    const localAssets = await this.getLocalAssets();
    const { toUpdate, toDelete } = this.compareWithLocal(metadata, localAssets);

    await this.deleteObsoleteAssets(toDelete, onProgress);
    await this.downloadUpdatedAssets(toUpdate, gasService, onProgress);

    onProgress?.("同期完了");
  }

  private async fetchMetadata(
    gasService: GasFunctionService,
    onProgress?: (message: string) => void
  ): Promise<AssetMetadata[]> {
    onProgress?.("Google Driveからアセットメタデータを取得中...");
    return new Promise((resolve, reject) => {
      gasService
        .createCall<{ metadata: AssetMetadata[] }>(
          "AssetService.getAllAssetMetadata"
        )
        .withTimeout(15000)
        .withSuccessed((res: { metadata: AssetMetadata[] }) =>
          resolve(res.metadata)
        )
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  private async getLocalAssets(): Promise<Asset[]> {
    const allLocalAssets = await this.localStorage.getAll<Asset>();
    return Array.from(allLocalAssets.values());
  }

  private compareWithLocal(
    metadata: AssetMetadata[],
    localAssets: Asset[]
  ): {
    toUpdate: AssetMetadata[];
    toDelete: Asset[];
  } {
    const serverIds = new Set(metadata.map((meta) => meta.id));
    const toUpdate = metadata.filter((meta) => {
      const local = localAssets.find((a) => a.id === meta.id);
      return !local || new Date(local.lastUpdated) < new Date(meta.lastUpdated);
    });
    const toDelete = localAssets.filter((local) => !serverIds.has(local.id));
    return { toUpdate, toDelete };
  }

  private async deleteObsoleteAssets(
    toDelete: Asset[],
    onProgress?: (message: string) => void
  ): Promise<void> {
    if (toDelete.length > 0) {
      onProgress?.(`${toDelete.length}個の不要なアセットを削除中...`);
      await this.localStorage.removeMultiple(toDelete.map((a) => a.id));
    }
  }

  private async downloadUpdatedAssets(
    toUpdate: AssetMetadata[],
    gasService: GasFunctionService,
    onProgress?: (message: string) => void
  ): Promise<void> {
    if (toUpdate.length === 0) return;

    onProgress?.(`${toUpdate.length}個のアセットをダウンロード中...`);
    const downloadPromises = toUpdate.map((meta) =>
      this.downloadAsset(meta, gasService, onProgress)
    );
    await Promise.all(downloadPromises);
  }

  private async downloadAsset(
    meta: AssetMetadata,
    gasService: GasFunctionService,
    onProgress?: (message: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      onProgress?.(
        `${meta.name} をダウンロード中... (${FileUtils.formatSize(meta.size)})`
      );
      gasService
        .createCall<{ asset: Asset | null }>("AssetService.getAsset", {
          assetId: meta.id,
        })
        .withTimeout(120000)
        .withSuccessed(async (assetRes: { asset: Asset | null }) => {
          if (assetRes.asset) {
            await this.localStorage.save(assetRes.asset.id, assetRes.asset);
          }
          onProgress?.(
            `${meta.name} ダウンロード完了 (${FileUtils.formatSize(meta.size)})`
          );
          resolve();
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }
}
