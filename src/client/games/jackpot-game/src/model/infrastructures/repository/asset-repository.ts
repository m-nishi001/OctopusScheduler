
import { GasFunctionService } from '../../../../../../packages/common-lib/src/google-apps-script/gas-script-service';
import type { Asset } from '../../domains/asset/Asset';
import { useLocalStorage } from '../../../../../../packages/shared-composables/src/use-localstorage';
const ASSET_CACHE_KEY = 'assets';

export class AssetRepository {
    private readonly gasService = GasFunctionService.create('callJackpotGameApi')!;
    private readonly localStorage = useLocalStorage();

    async fetchAssets(): Promise<Asset[]> {
        const cached = await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY);
        if (cached && cached.length > 0) {
            return cached;
        }
        if (!this.gasService) return [];
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<{ assets: Asset[] }>('AssetService.getAssets')
                .withSuccessed((res: { assets: Asset[] }) => {
                    this.localStorage.save(ASSET_CACHE_KEY, res.assets);
                    resolve(res.assets);
                })
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async saveAsset(asset: Asset): Promise<void> {
        const assets = (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
        assets.push(asset);
        await this.localStorage.save(ASSET_CACHE_KEY, assets);
        if (!this.gasService) return;
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<void>('AssetService.saveAsset', asset)
                .withSuccessed(() => resolve())
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async updateAsset(asset: Asset): Promise<void> {
        let assets = (await this.localStorage.get<Asset[]>(ASSET_CACHE_KEY)) || [];
        assets = assets.map((a: Asset) => a.id === asset.id ? asset : a);
        await this.localStorage.save(ASSET_CACHE_KEY, assets);
        if (!this.gasService) return;
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<void>('AssetService.updateAsset', asset)
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
                .createCall<void>('AssetService.deleteAsset', { assetId })
                .withSuccessed(() => resolve())
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async syncAssetsWithServer(): Promise<Asset[]> {
        if (!this.gasService) return [];
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<{ assets: Asset[] }>('AssetService.getAssets')
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
        return assets.find(a => a.id === assetId);
    }
}

export interface GetAssetsRequest { }
export interface GetAssetsResponse { assets: Asset[]; }
export interface ErrorResponse { code: string; message: string; }
