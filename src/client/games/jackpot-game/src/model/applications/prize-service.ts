import { injectable, inject } from "tsyringe";
import type { IPrizeRepository } from "../domains/prize/repository/IPrizeRepository";
import type { IAssetRepository } from "../../model/domains/asset/repository/IAssetRepository";
import type { PrizeDto } from "./dto/prize-dto";

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

  async batchOperations(adds: PrizeDto[], updates: PrizeDto[], deletes: string[]): Promise<void> {
    for (const prize of adds) {
      if (
        (prize as any).imageAsset &&
        typeof (prize as any).imageAsset !== "string"
      ) {
        const assetDto = {
          id: prize.imageAssetId || "",
          type: "image" as "image",
          dataUrl: "",
          name: prize.name + "_image",
          uploadedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          size: (prize as any).imageAsset.size || 0,
        };
        await this.assetRepo.addAsset(assetDto);
        prize.imageAssetId = assetDto.id;
        (prize as any).imageAssetUrl = assetDto.dataUrl;
      }
    }
    for (const prize of updates) {
      if (
        (prize as any).imageAsset &&
        typeof (prize as any).imageAsset !== "string"
      ) {
        const assetDto = {
          id: prize.imageAssetId || "",
          type: "image" as "image",
          dataUrl: "",
          name: prize.name + "_image",
          uploadedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          size: (prize as any).imageAsset.size || 0,
        };
        await this.assetRepo.updateAsset(assetDto);
        prize.imageAssetId = assetDto.id;
        (prize as any).imageAssetUrl = assetDto.dataUrl;
      }
    }
    await this.repo.batchOperations(adds, updates, deletes);
  }
}
