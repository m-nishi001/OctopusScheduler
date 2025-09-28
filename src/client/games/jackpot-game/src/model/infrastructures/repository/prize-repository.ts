
import type { Prize } from '../../domains/prize/Prize';
import { GasFunctionService } from '../../../../../../packages/common-lib/src/google-apps-script/gas-script-service';
import { useLocalStorage } from '../../../../../../packages/shared-composables/src/use-localstorage';
const PRIZE_CACHE_KEY = 'prizes';

export class PrizeRepository {
    private readonly gasService = GasFunctionService.create('callJackpotGameApi')!;
    private readonly localStorage = useLocalStorage();

    async fetchPrizes(): Promise<Prize[]> {
        // 1. キャッシュ優先
        const cached = await this.localStorage.get<Prize[]>(PRIZE_CACHE_KEY);
        if (cached && cached.length > 0) {
            return cached;
        }
        // 2. GAS APIフォールバック
        if (!this.gasService) return [];
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<{ prizes: Prize[] }>('PrizeService.getPrizes')
                .withSuccessed((res: { prizes: Prize[] }) => {
                    this.localStorage.save(PRIZE_CACHE_KEY, res.prizes);
                    resolve(res.prizes);
                })
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async savePrize(prize: Prize): Promise<void> {
        // 1. キャッシュ保存
        const prizes = (await this.localStorage.get<Prize[]>(PRIZE_CACHE_KEY)) || [];
        prizes.push(prize);
        await this.localStorage.save(PRIZE_CACHE_KEY, prizes);
        // 2. GAS API保存
        if (!this.gasService) return;
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<void>('PrizeService.savePrize', prize)
                .withSuccessed(() => resolve())
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async updatePrize(prize: Prize): Promise<void> {
        // 1. キャッシュ更新
        let prizes = (await this.localStorage.get<Prize[]>(PRIZE_CACHE_KEY)) || [];
        prizes = prizes.map((p: Prize) => p.id === prize.id ? prize : p);
        await this.localStorage.save(PRIZE_CACHE_KEY, prizes);
        // 2. GAS API更新
        if (!this.gasService) return;
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<void>('PrizeService.updatePrize', prize)
                .withSuccessed(() => resolve())
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async deletePrize(prizeId: string): Promise<void> {
        // 1. キャッシュ削除
        let prizes = (await this.localStorage.get<Prize[]>(PRIZE_CACHE_KEY)) || [];
        prizes = prizes.filter((p: Prize) => p.id !== prizeId);
        await this.localStorage.save(PRIZE_CACHE_KEY, prizes);
        // 2. GAS API削除
        if (!this.gasService) return;
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<void>('PrizeService.deletePrize', { prizeId })
                .withSuccessed(() => resolve())
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async syncPrizesWithServer(): Promise<Prize[]> {
        // 強制的にサーバーから取得しキャッシュ更新
        if (!this.gasService) return [];
        return new Promise((resolve, reject) => {
            this.gasService
                .createCall<{ prizes: Prize[] }>('PrizeService.getPrizes')
                .withSuccessed((res: { prizes: Prize[] }) => {
                    this.localStorage.save(PRIZE_CACHE_KEY, res.prizes);
                    resolve(res.prizes);
                })
                .withFailuered((msg: string) => reject(new Error(msg)))
                .invoke();
        });
    }

    async getPrizeById(prizeId: string): Promise<Prize | undefined> {
        const prizes = await this.fetchPrizes();
        return prizes.find(p => p.id === prizeId);
    }
}

export interface GetPrizesRequest { }
export interface GetPrizesResponse { prizes: Prize[]; }
export interface ErrorResponse { code: string; message: string; }
