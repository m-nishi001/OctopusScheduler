import type { Prize } from "../../domains/prize/prize";
import { LocalStorageService } from "../../../../../../packages/common-lib/src/storage/local-storage-service";
import { StorageConfig } from "../../infrastructures/storage-config";
import { injectable } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";

declare const google: any;

@injectable()
export class PrizeRepository implements IPrizeRepository {
  private readonly localStorage = new LocalStorageService(
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
  }

  async deletePrizes(ids: string[]): Promise<void> {
    await this.localStorage.removeMultiple(ids);
  }
}
