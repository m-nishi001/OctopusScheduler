import { injectable, inject } from "tsyringe";
import type { IAssetRepository } from "../../domains/asset/repository/i-asset-repository";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";
import type { PrizeDto } from "./dto/prize-dto";
import { toPrize } from "./dto/prize-dto";
import type { AssetDto } from "../asset/dto/asset-dto";
import type { Prize } from "../../domains/prize/prize";
import { AssetService } from "../asset/asset-service";

@injectable()
export class PrizeAddService {
  constructor(
    @inject("IAssetRepository") private assetRepo: IAssetRepository,
    @inject("IPrizeRepository") private prizeRepo: IPrizeRepository,
    @inject(AssetService) private assetService: AssetService
  ) {}

  async savePrize(
    prize: PrizeDto,
    tempAssetDto?: AssetDto,
    tempBgm1AssetDto?: AssetDto,
    tempBgm2AssetDto?: AssetDto
  ): Promise<Prize> {
    let assetId: string | undefined;
    if (tempAssetDto) {
      const assets = await this.assetRepo.addAssets([
        await tempAssetDto.toAsset(),
      ]);
      assetId = assets[0];
    }
    let bgm1AssetId: string | undefined;
    if (tempBgm1AssetDto) {
      const assets = await this.assetRepo.addAssets([
        await tempBgm1AssetDto.toAsset(),
      ]);
      bgm1AssetId = assets[0];
    }
    let bgm2AssetId: string | undefined;
    if (tempBgm2AssetDto) {
      const assets = await this.assetRepo.addAssets([
        await tempBgm2AssetDto.toAsset(),
      ]);
      bgm2AssetId = assets[0];
    }
    const prizeToSave = {
      ...prize,
      imageAssetId: assetId || prize.imageAssetId,
      bgm1AssetId: bgm1AssetId || prize.bgm1AssetId,
      bgm2AssetId: bgm2AssetId || prize.bgm2AssetId,
    };
    await this.prizeRepo.addPrizes([toPrize(prizeToSave)]);
    const addedPrize = toPrize(prizeToSave);
    if (tempAssetDto) {
      addedPrize.imageDataUrl = tempAssetDto.dataUrl;
    }
    if (assetId) {
      // ここは待たなくて良い。
      this.assetService.registerRef(assetId, addedPrize.id);
    }
    if (bgm1AssetId) {
      this.assetService.registerRef(bgm1AssetId, addedPrize.id);
    }
    if (bgm2AssetId) {
      this.assetService.registerRef(bgm2AssetId, addedPrize.id);
    }
    return addedPrize;
  }
}
