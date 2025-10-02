import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { injectable } from "tsyringe";
import type { Asset } from "../../domains/asset/asset";
import type {
  AssetDto,
  AssetMetadataDto,
} from "../../applications/dto/asset-dto";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../../infrastructures/storage-config";
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

  async fetchAssets(): Promise<Asset[]> {
    const cached = await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY);
    if (cached && cached.length > 0) {
      return cached;
    }
    if (!this.gasService) return [];
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ assets: Asset[] }>("AssetService.getAssets")
        .withSuccessed((res: { assets: Asset[] }) => {
          this.localStorage.save(ASSET_CACHE_KEY, res.assets);
          resolve(res.assets);
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async addAsset(asset: AssetDto): Promise<void> {
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ asset: AssetDto }>("AssetService.addAsset", asset)
        .withSuccessed((res: { asset: AssetDto }) => {
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
    files: File[],
    onProgress?: (index: number, success: boolean) => void
  ): Promise<{ successful: File[]; failed: File[] }> {
    if (!this.gasService) return { successful: [], failed: files };
    const assetDtos: AssetDto[] = [];
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file);
      const asset: AssetDto = {
        id: "",
        name: file.name,
        type: getAssetType(file.type),
        dataUrl: dataUrl,
        uploadedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        size: file.size,
        meta: {},
      };
      assetDtos.push(asset);
    }
    const calls = assetDtos.map((asset) =>
      this.gasService!.createCall<{ asset: AssetDto }>(
        "AssetService.addAsset",
        asset
      ).withTimeout(30000)
    );
    // 各呼び出しのPromiseを作成し、完了時にonProgressを呼ぶ
    const promises = calls.map((call, index) => {
      return new Promise<{ index: number; success: AssetDto | false }>(
        (resolve) => {
          call
            .withSuccessed((res: { asset: AssetDto }) => {
              if (onProgress) onProgress(index, true);
              // サーバーから返ってきたdataUrlをdataUrlに置き換え
              res.asset.dataUrl = assetDtos[index].dataUrl;
              resolve({ index, success: res.asset });
            })
            .withFailuered(() => {
              if (onProgress) onProgress(index, false);
              resolve({ index, success: false });
            })
            .invoke();
        }
      );
    });
    // 全ての呼び出しが完了するのを待つ
    const results = await Promise.all(promises);
    // 成功したファイルと失敗したファイルを分ける
    const successful: File[] = [];
    const failed: File[] = [];
    const successfulAssets: AssetDto[] = [];
    results.forEach(({ index, success }) => {
      if (success) {
        successful.push(files[index]);
        successfulAssets.push(success);
      } else {
        failed.push(files[index]);
      }
    });
    // 成功したものをローカルストレージに追加
    if (successful.length > 0) {
      const current =
        (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
      await this.localStorage.save(ASSET_CACHE_KEY, [
        ...current,
        ...successfulAssets,
      ]);
    }
    return { successful, failed };
  }

  async updateAsset(asset: Asset): Promise<void> {
    let assets = (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
    assets = assets.map((a: Asset) => (a.id === asset.id ? asset : a));
    await this.localStorage.save(ASSET_CACHE_KEY, assets);
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("AssetService.updateAsset", asset)
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async deleteAsset(assetId: string): Promise<void> {
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("AssetService.deleteAsset", { assetId })
        .withSuccessed(async () => {
          let assets =
            (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
          assets = assets.filter((a: Asset) => a.id !== assetId);
          await this.localStorage.save(ASSET_CACHE_KEY, assets);
          resolve();
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
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

  async syncAssetsWithServer(): Promise<Asset[]> {
    if (!this.gasService) return [];
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ assets: Asset[] }>("AssetService.getAssets")
        .withSuccessed((res: { assets: Asset[] }) => {
          this.localStorage.save(ASSET_CACHE_KEY, res.assets);
          resolve(res.assets);
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async syncAssetsWithGoogleDrive(
    onProgress?: (message: string) => void
  ): Promise<void> {
    if (!this.gasService) return;
    // サーバーからアセットメタデータを取得
    const { assets: serverAssetsInfo }: { assets: AssetMetadataDto[] } =
      await new Promise((resolve, reject) => {
        this.gasService!.createCall<{
          assets: AssetMetadataDto[];
        }>("AssetService.getAssetMetadata")
          .withTimeout(30000)
          .withSuccessed((res: { assets: AssetMetadataDto[] }) => resolve(res))
          .withFailuered((msg: string) => reject(new Error(msg)))
          .invoke();
      });
    onProgress?.("メタデータ取得完了");
    // ローカルアセットを取得
    const localAssets =
      (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
    // IDをキーとしたマップ作成
    const localAssetsMap = new Map(localAssets.map((a) => [a.id, a]));
    const serverAssetsMap = new Map(serverAssetsInfo.map((a) => [a.id, a]));
    // 追加・更新・削除を決定
    const toAdd: string[] = [];
    const toUpdate: string[] = [];
    const toDelete: string[] = [];
    // サーバーにあってローカルにない: 追加
    for (const serverAsset of serverAssetsInfo) {
      if (!localAssetsMap.has(serverAsset.id)) {
        toAdd.push(serverAsset.id);
      } else {
        // ローカルにある場合、最終更新日時を比較
        const localAsset = localAssetsMap.get(serverAsset.id)!;
        if (
          new Date(localAsset.lastUpdated) < new Date(serverAsset.lastUpdated)
        ) {
          toUpdate.push(serverAsset.id);
        }
      }
    }
    // ローカルにあってサーバーにない: 削除
    for (const localAsset of localAssets) {
      if (!serverAssetsMap.has(localAsset.id)) {
        toDelete.push(localAsset.id);
      }
    }
    // 追加・更新のアセットデータを並列取得
    if (toAdd.length + toUpdate.length > 0) {
      onProgress?.(
        `ファイルダウンロード中 (${toAdd.length + toUpdate.length}件)`
      );
      const assetPromises = [...toAdd, ...toUpdate].map(
        (id) =>
          new Promise<Asset | null>((resolve) => {
            this.gasService!.createCall<{ asset: Asset | null }>(
              "AssetService.getDomainAsset",
              id
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
              .withFailuered(() => {
                resolve(null);
              })
              .invoke();
          })
      );
      const newOrUpdatedAssets = await Promise.all(assetPromises);
      const validAssets = newOrUpdatedAssets.filter(
        (a): a is Asset => !!a && a.id !== undefined && a.id !== null
      );
      // ローカルストレージ更新
      let updatedLocalAssets = localAssets.filter(
        (a) => !toDelete.includes(a.id)
      );
      // 既存の更新分を削除
      updatedLocalAssets = updatedLocalAssets.filter(
        (a) => !toUpdate.includes(a.id)
      );
      // 新規と更新を追加
      updatedLocalAssets = [...updatedLocalAssets, ...validAssets];
      await this.localStorage.save(ASSET_CACHE_KEY, updatedLocalAssets);
    } else if (toDelete.length > 0) {
      // 削除のみの場合もローカルストレージを更新
      let updatedLocalAssets = localAssets.filter(
        (a) => !toDelete.includes(a.id)
      );
      await this.localStorage.save(ASSET_CACHE_KEY, updatedLocalAssets);
    }
    onProgress?.("同期完了");
  }

  async getAssetById(assetId: string): Promise<Asset | undefined> {
    const assets = await this.fetchAssets();
    return assets.find((a) => a.id === assetId);
  }
}

const getAssetType = (
  mimeType: string
): "image" | "video" | "audio" | "text" => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "text";
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
