import { injectable, inject } from "tsyringe";
import type { IAssetRepository } from "../../domains/asset/repository/i-asset-repository";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";
import type { PrizeDto } from "./dto/prize-dto";
import { toPrize } from "./dto/prize-dto";
import type { Asset } from "../../domains/asset/asset";
import type { Prize } from "../../domains/prize/prize";
import { FileUtils } from "../../infrastructures/utils/file-utils";
import { AssetService } from "../asset/asset-service";

@injectable()
export class PrizeAddService {
  constructor(
    @inject("IAssetRepository") private assetRepo: IAssetRepository,
    @inject("IPrizeRepository") private prizeRepo: IPrizeRepository,
    @inject(AssetService) private assetService: AssetService
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

  async savePrize(
    prize: PrizeDto,
    tempAsset?: Asset,
    tempBgm1Asset?: Asset,
    tempBgm2Asset?: Asset
  ): Promise<Prize> {
    let assetId: string | undefined;
    if (tempAsset) {
      const assets = await this.assetRepo.addAssets([tempAsset]);
      assetId = assets[0];
    }
    let bgm1AssetId: string | undefined;
    if (tempBgm1Asset) {
      const assets = await this.assetRepo.addAssets([tempBgm1Asset]);
      bgm1AssetId = assets[0];
    }
    let bgm2AssetId: string | undefined;
    if (tempBgm2Asset) {
      const assets = await this.assetRepo.addAssets([tempBgm2Asset]);
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
    if (tempAsset) {
      addedPrize.imageDataUrl = tempAsset.dataUrl;
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
