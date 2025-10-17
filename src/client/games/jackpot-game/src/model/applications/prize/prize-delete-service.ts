import { injectable, inject } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";

@injectable()
export class PrizeDeleteService {
  constructor(@inject("IPrizeRepository") private repo: IPrizeRepository) {}

  async deletePrize(id: string): Promise<void> {
    await this.repo.deletePrizes([id]);
  }

  async deletePrizes(ids: string[]): Promise<void> {
    await this.repo.deletePrizes(ids);
  }
}
