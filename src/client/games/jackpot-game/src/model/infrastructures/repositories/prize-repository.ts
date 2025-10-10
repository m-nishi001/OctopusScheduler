import type { Prize } from "../../domains/prize/prize";
import type { PrizeDto } from "../../applications/prize/dto/prize-dto";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import { injectable } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/IPrizeRepository";

const PRIZE_CACHE_KEY = "prizes";

@injectable()
export class PrizeRepository implements IPrizeRepository {
  private readonly gasService =
    GasFunctionService.create("callJackpotGameApi")!;
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("PrizeData")
  );

  async fetchPrizes(): Promise<PrizeDto[]> {
    const cached = await this.localStorage.get<Prize[]>(PRIZE_CACHE_KEY);
    if (cached && cached.length > 0) {
      return cached;
    }
    if (!this.gasService) return [];
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ prizes: Prize[] }>("PrizeService.getPrizes")
        .withSuccessed((res: { prizes: Prize[] }) => {
          this.localStorage.save(PRIZE_CACHE_KEY, res.prizes);
          resolve(res.prizes);
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async batchOperations(
    adds: PrizeDto[],
    updates: PrizeDto[],
    deletes: string[]
  ): Promise<void> {
    let prizes =
      (await this.localStorage.get<PrizeDto[]>(PRIZE_CACHE_KEY)) || [];
    prizes.push(...adds);
    for (const update of updates) {
      const idx = prizes.findIndex((p) => p.id === update.id);
      if (idx >= 0) prizes[idx] = update;
    }
    prizes = prizes.filter((p) => !deletes.includes(p.id));
    await this.localStorage.save(PRIZE_CACHE_KEY, prizes);
    if (!this.gasService) return;
    const updateArgs = updates.map((u) => ({ ids: [u.id], prize: u }));
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("PrizeService.batchOperations", {
          adds,
          updates: updateArgs,
          deletes,
        })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async syncPrizesWithServer(): Promise<PrizeDto[]> {
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
