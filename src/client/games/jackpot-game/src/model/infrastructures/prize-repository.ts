import type { Prize } from "../domains/prize/prize";
import { LocalStorageService } from "packages/common-lib/storage/local-storage-service";
import { injectable } from "tsyringe";
import type { IPrizeRepository } from "../domains/prize/repository/i-prize-repository";

@injectable()
export class PrizeRepository implements IPrizeRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "PrizeData"
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

  async replaceAllPrizes(prizes: Prize[]): Promise<{ replaced: number }> {
    // clear existing
    const all = await this.localStorage.getAll<Prize>();
    const keys = Array.from(all.keys());
    if (keys.length) {
      await this.localStorage.removeMultiple(keys);
    }
    // save provided prizes
    for (const prize of prizes) {
      const id =
        prize.id || String(Date.now()) + Math.random().toString(36).slice(2, 8);
      await this.localStorage.save(id, { ...prize, id });
    }
    return { replaced: prizes.length };
  }
}
