import { injectable, inject } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/IPrizeRepository";
import type { IAssetRepository } from "../../domains/asset/repository/IAssetRepository";
import type { PrizeDto } from "./dto/prize-dto";
import { AssetDto } from "../asset/dto/asset-dto";

@injectable()
export class PrizeService {
  constructor(
    @inject("IPrizeRepository") private repo: IPrizeRepository,
    @inject("IAssetRepository") private assetRepo: IAssetRepository
  ) {}

  async fetchPrizes(): Promise<PrizeDto[]> {
    const prizes = await this.repo.fetchPrizes();
    if (!Array.isArray(prizes) || !prizes) return [];
    return prizes.map((p) => ({ ...p }));
  }

  async batchOperations(
    adds: PrizeDto[],
    updates: PrizeDto[],
    deletes: string[]
  ): Promise<void> {
    for (const prize of adds) {
      if (
        (prize as any).imageAsset &&
        typeof (prize as any).imageAsset !== "string"
      ) {
        const file = (prize as any).imageAsset as File;
        const assetDto = new AssetDto(file);
        await assetDto.setDataUrl();
        await this.assetRepo.addAssets([assetDto]);
        prize.imageAssetId = assetDto.id;
        (prize as any).imageAssetUrl = assetDto.dataUrl;
      }
    }
    for (const prize of updates) {
      if (
        (prize as any).imageAsset &&
        typeof (prize as any).imageAsset !== "string"
      ) {
        const file = (prize as any).imageAsset as File;
        const assetDto = new AssetDto(file);
        await assetDto.setDataUrl();
        await this.assetRepo.updateAssets([assetDto]);
        prize.imageAssetId = assetDto.id;
        (prize as any).imageAssetUrl = assetDto.dataUrl;
      }
    }
    await this.repo.batchOperations(adds, updates, deletes);
  }
}
