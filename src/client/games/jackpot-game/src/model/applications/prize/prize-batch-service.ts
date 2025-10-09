import { injectable, inject } from "tsyringe";
import type { PrizeDto } from "./dto/prize-dto";
import { AssetDto } from "../asset/dto/asset-dto";
import { AssetService } from "../asset/asset-service";
import { PrizeService } from "./prize-service";

interface PrizeDtoWithAssets extends PrizeDto {
  imageAsset?: AssetDto;
  bgm1Asset?: AssetDto;
  bgm2Asset?: AssetDto;
}

@injectable()
export class PrizeBatchService {
  constructor(
    @inject(AssetService) private assetService: AssetService,
    @inject(PrizeService) private prizeService: PrizeService
  ) {}

  async execute(operations: {
    add: PrizeDtoWithAssets[];
    update: PrizeDto[];
    delete: PrizeDto[];
  }): Promise<void> {
    await Promise.all([
      this.processAddPrizes(operations.add),
      this.processDeletePrizes(operations.delete),
    ]);

    const cleanedOperations = {
      add: operations.add.map(
        ({ imageAsset, bgm1Asset, bgm2Asset, ...p }) => p
      ),
      update: operations.update,
      delete: operations.delete.map((p) => p.id),
    };

    await this.prizeService.batchOperations(cleanedOperations);
  }

  private async processAddPrizes(prizes: PrizeDtoWithAssets[]): Promise<void> {
    const assetDtos: AssetDto[] = [];
    prizes.forEach((prize) => {
      if (prize.imageAsset) assetDtos.push(prize.imageAsset);
      if (prize.bgm1Asset) assetDtos.push(prize.bgm1Asset);
      if (prize.bgm2Asset) assetDtos.push(prize.bgm2Asset);
    });
    if (assetDtos.length === 0) return;
    const result = await this.assetService.addAssets(assetDtos);
    let idx = 0;
    prizes.forEach((prize) => {
      if (prize.imageAsset) {
        prize.imageAssetId = result.successful[idx++].id;
      }
      if (prize.bgm1Asset) {
        prize.bgm1AssetId = result.successful[idx++].id;
      }
      if (prize.bgm2Asset) {
        prize.bgm2AssetId = result.successful[idx++].id;
      }
    });
  }

  private async processDeletePrizes(prizes: PrizeDto[]): Promise<void> {
    const assetIds: string[] = [];
    prizes.forEach((prize) => {
      if (prize.imageAssetId) assetIds.push(prize.imageAssetId);
      if (prize.bgm1AssetId) assetIds.push(prize.bgm1AssetId);
      if (prize.bgm2AssetId) assetIds.push(prize.bgm2AssetId);
    });
    if (assetIds.length === 0) return;
    await this.assetService.deleteAssets(assetIds);
  }
}
