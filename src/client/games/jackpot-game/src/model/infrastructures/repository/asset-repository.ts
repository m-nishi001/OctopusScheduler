import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { injectable } from "tsyringe";
import type { Asset } from "../../domains/asset/asset";
import type { AssetDto } from "../../applications/dto/asset-dto";
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

  async syncAssetsWithGoogleDrive(): Promise<void> {
    if (!this.gasService) return;
    // サーバーからアセットIDリストを取得
    const { ids }: { ids: string[] } = await new Promise((resolve, reject) => {
      this.gasService!.createCall<{ ids: string[] }>("AssetService.getAssetIds")
        .withTimeout(30000)
        .withSuccessed((res: { ids: string[] }) => resolve(res))
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
    // 各IDに対してgetDomainAssetを並列で呼び出し
    // サーバー側が { asset: Asset } を返す場合と、Asset そのもの or null を返す場合があるため
    // 柔軟にハンドリングする。各呼び出しは失敗しても個別に null を返すようにして
    // Promise.all が reject にならないようにする。
    const assetPromises = ids.map(
      (id) =>
        new Promise<Asset | null>((resolve) => {
          this.gasService!.createCall<{ asset: Asset | null }>(
            "AssetService.getDomainAsset",
            id
          )
            .withTimeout(120000) // 2分に延長
            .withSuccessed((res: { asset: Asset | null }) => {
              // サーバーは常に { asset: Asset | null } を返す想定
              resolve(res.asset);
            })
            .withFailuered(() => {
              // 個別の取得に失敗しても全体を止めない（null を返す）
              resolve(null);
            })
            .invoke();
        })
    );
    const serverAssetsRaw = await Promise.all(assetPromises);
    // null / undefined の要素を取り除き、id を持つ要素だけを採用
    const serverAssets = serverAssetsRaw.filter(
      (a): a is Asset =>
        !!a && (a as any).id !== undefined && (a as any).id !== null
    );
    // ローカルアセットを取得
    const localAssets =
      (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
    // IDセットで比較
    const serverIds = new Set(serverAssets.map((a) => a.id));
    const localIds = new Set(localAssets.map((a) => a.id));
    // サーバーにあってローカルにない: 追加
    const toAdd = serverAssets.filter((a) => !localIds.has(a.id));
    // ローカルにあってサーバーにない: 削除
    const toDelete = localAssets
      .filter((a) => !serverIds.has(a.id))
      .map((a) => a.id);
    // 並列実行
    const addPromises = toAdd.map(
      (asset) =>
        new Promise<void>((resolve) => {
          // ローカルストレージに追加
          this.localStorage.get<Asset[]>(ASSET_CACHE_KEY).then((current) => {
            const updated = current ? [...current, asset] : [asset];
            this.localStorage
              .save(ASSET_CACHE_KEY, updated)
              .then(() => resolve());
          });
        })
    );
    const deletePromises = toDelete.map((assetId) => this.deleteAsset(assetId));
    await Promise.all([...addPromises, ...deletePromises]);
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
