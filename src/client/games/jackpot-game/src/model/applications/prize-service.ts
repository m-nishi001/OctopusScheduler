import { PrizeRepository } from '../../model/infrastructures/repository/prize-repository';
import type { PrizeDto } from './dto/prize-dto';

export class PrizeService {
  private readonly repo = new PrizeRepository();

  async fetchPrizes(): Promise<PrizeDto[]> {
    const prizes = await this.repo.fetchPrizes();
    if (!Array.isArray(prizes) || !prizes) return [];
    // Entity -> DTO変換（必要ならマッピング処理を追加）
    return prizes.map(p => ({ ...p }));
  }

  async savePrize(prize: PrizeDto): Promise<void> {
    await this.repo.savePrize(prize);
  }

  async updatePrize(prize: PrizeDto): Promise<void> {
    await this.repo.updatePrize(prize);
  }

  async deletePrize(prizeId: string): Promise<void> {
    await this.repo.deletePrize(prizeId);
  }
}
