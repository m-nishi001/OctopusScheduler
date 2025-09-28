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

  /** 新規追加専用 */
  async addPrize(prize: PrizeDto): Promise<void> {
    if (
      (prize as any).imageAsset &&
      typeof (prize as any).imageAsset !== "string"
    ) {
      const assetDto = {
        id: prize.imageAssetId || "",
        type: "image" as "image",
        url: "",
        name: prize.name + "_image",
        uploadedAt: new Date().toISOString(),
        size: (prize as any).imageAsset.size || 0,
      };
      await this.assetRepo.addAsset(assetDto);
      prize.imageAssetId = assetDto.id;
      (prize as any).imageAssetUrl = assetDto.url;
    }
    await this.repo.addPrize(prize);
  }

  async updatePrize(prize: PrizeDto): Promise<void> {
    if (
      (prize as any).imageAsset &&
      typeof (prize as any).imageAsset !== "string"
    ) {
      const assetDto = {
        id: prize.imageAssetId || "",
        type: "image" as "image",
        url: "",
        name: prize.name + "_image",
        uploadedAt: new Date().toISOString(),
        size: (prize as any).imageAsset.size || 0,
      };
      await this.assetRepo.updateAsset(assetDto);
      prize.imageAssetId = assetDto.id;
      (prize as any).imageAssetUrl = assetDto.url;
    }
    await this.repo.updatePrize(prize);
  }

  async deletePrize(prizeId: string): Promise<void> {
    await this.repo.deletePrize(prizeId);
  }
}
