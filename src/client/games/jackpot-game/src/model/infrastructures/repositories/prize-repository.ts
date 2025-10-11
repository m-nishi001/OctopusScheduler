import type { Prize } from "../../domains/prize/prize";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import { injectable } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/IPrizeRepository";
import type { PrizeDto } from "../../applications/prize/dto/prize-dto";

@injectable()
export class PrizeRepository implements IPrizeRepository {
  private readonly gasService =
    GasFunctionService.create("callJackpotGameApi")!;
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("PrizeData")
  );

  async getPrizes(): Promise<Prize[]> {
    const allPrizes = await this.localStorage.getAll<Prize>();
    return Array.from(allPrizes.values());
  }

  async getPrizeById(id: string): Promise<Prize | null> {
    return (await this.localStorage.get<Prize>(id)) || null;
  }

  async addPrizes(prizes: Prize[]): Promise<void> {
    for (const prize of prizes) {
      await this.localStorage.save(prize.id, prize);
    }
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
    for (const update of updates) {
      const current = await this.localStorage.get<Prize>(update.id);
      if (current) {
        const updated = update.updateFn(current);
        await this.localStorage.save(update.id, updated);
      }
    }
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
    await this.localStorage.removeMultiple(ids);
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
        .createCall<PrizeDto[]>("PrizeService.getPrizes")
        .withSuccessed(async (res: PrizeDto[]) => {
          const serverPrizes = res.map((p) => ({
            id: p.id,
            name: p.name,
            probability: p.probability,
            rank: p.rank,
            imageAssetId: p.imageAssetId,
            bgm1AssetId: p.bgm1AssetId,
            bgm2AssetId: p.bgm2AssetId,
            order: p.order,
          }));
          for (const prize of serverPrizes) {
            await this.localStorage.save(prize.id, prize);
          }
          resolve();
        })
        .withFailuered((msg: string) => reject(new Error(msg)))
        .invoke();
    });
  }
}
