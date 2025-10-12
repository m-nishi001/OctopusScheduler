import { injectable, inject } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";
import { AssetService } from "../asset/asset-service";

@injectable()
export class PrizeDeleteService {
  constructor(
    @inject("IPrizeRepository") private repo: IPrizeRepository,
    @inject(AssetService) private assetService: AssetService
  ) {}

  async deletePrize(id: string): Promise<void> {
    const prize = await this.repo.getPrizeById(id);
    await this.repo.deletePrizes([id]);
    if (prize?.imageAssetId) {
      await this.assetService.unregisterRef(prize.imageAssetId, prize.id);
    }
    if (prize?.bgm1AssetId) {
      await this.assetService.unregisterRef(prize.bgm1AssetId, prize.id);
    }
    if (prize?.bgm2AssetId) {
      await this.assetService.unregisterRef(prize.bgm2AssetId, prize.id);
    }
  }

  async deletePrizes(ids: string[]): Promise<void> {
    const prizes = await Promise.all(
      ids.map((id) => this.repo.getPrizeById(id))
    );
    await this.repo.deletePrizes(ids);
    for (const prize of prizes) {
      if (prize?.imageAssetId) {
        await this.assetService.unregisterRef(prize.imageAssetId, prize.id);
      }
      if (prize?.bgm1AssetId) {
        await this.assetService.unregisterRef(prize.bgm1AssetId, prize.id);
      }
      if (prize?.bgm2AssetId) {
        await this.assetService.unregisterRef(prize.bgm2AssetId, prize.id);
      }
    }
  }
}
