import type { Prize } from "../../domains/prize/prize";
import type { PrizeDto } from "../../applications/dto/prize-dto";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../../infrastructures/storage-config";
import { injectable } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/IPrizeRepository";

const PRIZE_CACHE_KEY = "prizes";

@injectable()
export class PrizeRepository implements IPrizeRepository {
  /** 差分更新: 変更・新規・削除のみ反映 */
  async savePrizes(newPrizes: Prize[]): Promise<void> {
    const oldPrizes =
      (await this.localStorage.get<Prize[]>(PRIZE_CACHE_KEY)) || [];
    // 新規・更新
    for (const prize of newPrizes) {
      const prev = oldPrizes.find((p) => p.id === prize.id);
      if (!prev) {
        await this.addPrize(prize);
      } else if (JSON.stringify(prev) !== JSON.stringify(prize)) {
        await this.updatePrize(prize);
      }
    }
    // 削除
    for (const old of oldPrizes) {
      if (!newPrizes.find((p) => p.id === old.id)) {
        await this.deletePrize(old.id);
      }
    }
  }
  private readonly gasService =
    GasFunctionService.create("callJackpotGameApi")!;
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("PrizeData")
  );

  async fetchPrizes(): Promise<PrizeDto[]> {
    // 1. キャッシュ優先
    const cached = await this.localStorage.get<Prize[]>(PRIZE_CACHE_KEY);
    if (cached && cached.length > 0) {
      return cached;
    }
    // 2. GAS APIフォールバック
    if (!this.gasService) return [];
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ prizes: Prize[] }>("PrizeService.getAll")
        .withSuccessed((res: { prizes: Prize[] }) => {
          this.localStorage.save(PRIZE_CACHE_KEY, res.prizes);
          resolve(res.prizes);
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async addPrize(prize: PrizeDto): Promise<void> {
    // 1. キャッシュ保存
    const prizes =
      (await this.localStorage.get<PrizeDto[]>(PRIZE_CACHE_KEY)) || [];
    prizes.push(prize);
    await this.localStorage.save(PRIZE_CACHE_KEY, prizes);
    // 2. GAS API追加
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("PrizeService.addPrize", { prize })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async updatePrize(prize: PrizeDto): Promise<void> {
    // 1. キャッシュ更新
    let prizes =
      (await this.localStorage.get<PrizeDto[]>(PRIZE_CACHE_KEY)) || [];
    prizes = prizes.map((p: PrizeDto) => (p.id === prize.id ? prize : p));
    await this.localStorage.save(PRIZE_CACHE_KEY, prizes);
    // 2. GAS API更新
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("PrizeService.updatePrize", { prize })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async deletePrize(prizeId: string): Promise<void> {
    // 1. キャッシュ削除
    let prizes =
      (await this.localStorage.get<PrizeDto[]>(PRIZE_CACHE_KEY)) || [];
    prizes = prizes.filter((p: PrizeDto) => p.id !== prizeId);
    await this.localStorage.save(PRIZE_CACHE_KEY, prizes);
    // 2. GAS API削除
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("PrizeService.delete", { id: prizeId })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async syncPrizesWithServer(): Promise<PrizeDto[]> {
    // 強制的にサーバーから取得しキャッシュ更新
    if (!this.gasService) return [];
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ prizes: Prize[] }>("PrizeService.getAll")
        .withSuccessed((res: { prizes: Prize[] }) => {
          this.localStorage.save(PRIZE_CACHE_KEY, res.prizes);
          resolve(res.prizes);
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async getPrizeById(prizeId: string): Promise<PrizeDto | undefined> {
    const prizes = await this.fetchPrizes();
    return prizes.find((p) => p.id === prizeId);
  }
}
