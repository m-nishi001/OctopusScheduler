import { injectable, inject } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";
import { IPrizeRepositoryToken } from "../../domains/prize/repository/i-prize-repository";
import type { PrizeDto } from "./dto/prize-dto";
import { fromPrize, toPrize } from "./dto/prize-dto";
import type { Prize } from "../../domains/prize/prize";

@injectable()
export class PrizeService {
  constructor(@inject(IPrizeRepositoryToken) private repo: IPrizeRepository) {}

  async fetchPrizes(): Promise<PrizeDto[]> {
    const prizes = await this.repo.getPrizes();
    return prizes.map(fromPrize);
  }

  async addPrize(prize: PrizeDto): Promise<void> {
    await this.repo.addPrizes([toPrize(prize)]);
  }

  async savePrize(prize: PrizeDto): Promise<Prize> {
    const prizeToSave = { ...prize };
    await this.repo.addPrizes([toPrize(prizeToSave)]);
    return toPrize(prizeToSave);
  }

  async updatePrize(id: string, prize: PrizeDto): Promise<void> {
    await this.deletePrize(id);
    await this.addPrize(prize);
  }

  async deletePrize(id: string): Promise<void> {
    await this.repo.deletePrizes([id]);
  }

  async deletePrizes(ids: string[]): Promise<void> {
    await this.repo.deletePrizes(ids);
  }

  async resetAllAssigned(): Promise<void> {
    // Reset not needed since assignment is in DrawResult
  }
}
