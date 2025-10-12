import { injectable, inject } from "tsyringe";
import type { IAssetRepository } from "../../domains/asset/repository/i-asset-repository";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";
import type { PrizeDto } from "./dto/prize-dto";
import { toPrize } from "./dto/prize-dto";
import type { Asset } from "../../domains/asset/asset";
import type { Prize } from "../../domains/prize/prize";
import { FileUtils } from "../../infrastructures/utils/file-utils";

@injectable()
export class PrizeAddService {
  constructor(
    @inject("IAssetRepository") private assetRepo: IAssetRepository,
    @inject("IPrizeRepository") private prizeRepo: IPrizeRepository
  ) {}

  async createTempAsset(file: File): Promise<Asset> {
    const dataUrl = await FileUtils.readAsDataUrl(file);
    return {
      id: "",
      name: file.name,
      type: FileUtils.getAssetType(file.type),
      dataUrl,
      uploadedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      size: file.size,
      referenceFrom: [],
    };
  }

  async savePrize(prize: PrizeDto, tempAsset?: Asset): Promise<Prize> {
    let assetId: string | undefined;
    if (tempAsset) {
      const assets = await this.assetRepo.addAssets([tempAsset]);
      assetId = assets[0];
    }
    const prizeToSave = {
      ...prize,
      imageAssetId: assetId || prize.imageAssetId,
    };
    await this.prizeRepo.addPrizes([toPrize(prizeToSave)]);
    const addedPrize = toPrize(prizeToSave);
    if (tempAsset) {
      addedPrize.imageDataUrl = tempAsset.dataUrl;
    }
    return addedPrize;
  }
}
