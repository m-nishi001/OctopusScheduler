import type { Prize } from "../../domains/prize/prize";
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

  async getPrizes(): Promise<Prize[]> {
    return (await this.localStorage.get<Prize[]>(PRIZE_CACHE_KEY)) || [];
  }

  async getPrizeById(id: string): Promise<Prize | null> {
    const prizes = await this.getPrizes();
    return prizes.find((p) => p.id === id) || null;
  }

  async addPrizes(prizes: Prize[]): Promise<void> {
    const current = await this.getPrizes();
    const updated = [...current, ...prizes];
    await this.localStorage.save(PRIZE_CACHE_KEY, updated);
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("PrizeService.addPrizes", { prizes })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async updatePrizes(
    updates: { id: string; updateFn: (prize: Prize) => Prize }[]
  ): Promise<void> {
    const current = await this.getPrizes();
    const updated = current.map((p) => {
      const update = updates.find((u) => u.id === p.id);
      return update ? update.updateFn(p) : p;
    });
    await this.localStorage.save(PRIZE_CACHE_KEY, updated);
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("PrizeService.updatePrizes", { updates })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async deletePrizes(ids: string[]): Promise<void> {
    const current = await this.getPrizes();
    const updated = current.filter((p) => !ids.includes(p.id));
    await this.localStorage.save(PRIZE_CACHE_KEY, updated);
    if (!this.gasService) return;
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<void>("PrizeService.deletePrizes", { ids })
        .withSuccessed(() => resolve())
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }

  async syncPrizes(): Promise<void> {
    if (!this.gasService) throw new Error("GAS service not available");
    return new Promise((resolve, reject) => {
      this.gasService
        .createCall<{ prizes: Prize[] }>("PrizeService.getPrizes")
        .withSuccessed(async (res: { prizes: Prize[] }) => {
          await this.localStorage.save(PRIZE_CACHE_KEY, res.prizes);
          resolve();
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }
}
