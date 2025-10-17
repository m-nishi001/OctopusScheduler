import type { Prize } from "../../domains/prize/prize";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import { injectable } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";

declare const google: any;

@injectable()
export class PrizeRepository implements IPrizeRepository {
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

  async syncPrizes(): Promise<{ synced: number }> {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler((data: any) => {
          if (data) {
            const serverPrizes = data.data.map((row: any[]) => ({
              id: row[0],
              name: row[1],
              probability: row[2],
              rank: row[3],
              imageAssetId: row[4],
              bgm1AssetId: row[5],
              bgm2AssetId: row[6],
              order: row[7],
            }));
            for (const prize of serverPrizes) {
              this.localStorage.save(prize.id, prize);
            }
            resolve({ synced: serverPrizes.length });
          } else {
            resolve({ synced: 0 });
          }
        })
        .withFailureHandler((error: any) => reject(new Error(error)))
        .getSpreadsheetData("Prizes");
    });
  }
}
