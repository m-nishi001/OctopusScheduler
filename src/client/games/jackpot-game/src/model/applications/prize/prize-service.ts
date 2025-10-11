import { injectable, inject } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/IPrizeRepository";
import type { PrizeDto } from "./dto/prize-dto";
import { fromPrize, toPrize } from "./dto/prize-dto";

@injectable()
export class PrizeService {
  constructor(@inject("IPrizeRepository") private repo: IPrizeRepository) {}

  async fetchPrizes(): Promise<PrizeDto[]> {
    const prizes = await this.repo.getPrizes();
    return prizes.map(fromPrize);
  }

  async addPrize(prize: PrizeDto): Promise<void> {
    await this.repo.addPrizes([toPrize(prize)]);
  }

  async updatePrize(id: string, prize: PrizeDto): Promise<void> {
    const updateOps = [{ id, updateFn: (_: any) => toPrize(prize) }];
    await this.repo.updatePrizes(updateOps);
  }

  async deletePrize(id: string): Promise<void> {
    await this.repo.deletePrizes([id]);
  }

  async syncPrizes(): Promise<void> {
    // サーバーから全景品を取得してローカルストレージに同期
    await this.repo.syncPrizes();
  }
}
