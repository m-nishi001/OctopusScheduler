import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { injectable } from "tsyringe";
import type { Asset } from "../../domains/asset/asset";
import type { AssetDto } from "../../applications/dto/asset-dto";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import type { IAssetRepository } from "../../domains/asset/repository/IAssetRepository";

const ASSET_CACHE_KEY = "assets";

@injectable()
export class AssetRepository implements IAssetRepository {
  private readonly gasService =
    GasFunctionService.create("callJackpotGameApi")!;
  private readonly localStorage = useLocalStorage();

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

  async addAssets(files: File[]): Promise<void> {
    if (!this.gasService) return;
    const assetDtos: AssetDto[] = [];
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file);
      const asset: AssetDto = {
        id: String(Date.now() + Math.random()),
        name: file.name,
        type: getAssetType(file.type),
        url: dataUrl,
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
    const results = await this.gasService!.all(...calls);
    // 成功したものをローカルストレージに追加
    const successfulAssets: AssetDto[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        successfulAssets.push(assetDtos[index]);
      }
    });
    if (successfulAssets.length > 0) {
      const current =
        (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
      await this.localStorage.save(ASSET_CACHE_KEY, [
        ...current,
        ...successfulAssets,
      ]);
    }
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
    let assets = (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
    assets = assets.filter((a: Asset) => a.id !== assetId);
    await this.localStorage.save(ASSET_CACHE_KEY, assets);
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("AssetService.deleteAsset", { assetId })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
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

  async getAssetById(assetId: string): Promise<Asset | undefined> {
    const assets = await this.fetchAssets();
    return assets.find((a) => a.id === assetId);
  }
}

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getAssetType = (
  mimeType: string
): "image" | "video" | "audio" | "text" => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "text";
};
