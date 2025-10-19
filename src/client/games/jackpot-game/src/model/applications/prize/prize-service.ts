import { injectable, inject } from "tsyringe";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";
import type { PrizeDto } from "./dto/prize-dto";
import { fromPrize, toPrize } from "./dto/prize-dto";
import { AssetDataService } from "../asset/asset-data-service";
import type { Asset } from "../../domains/drive-data/asset-data";
import type { Prize } from "../../domains/prize/prize";

@injectable()
export class PrizeService {
  constructor(
    @inject("DriveDataService") private driveDataService: AssetDataService,
    @inject("IPrizeRepository") private repo: IPrizeRepository
  ) {}

  async fetchPrizes(): Promise<PrizeDto[]> {
    const prizes = await this.repo.getPrizes();
    return prizes.map(fromPrize);
  }

  async addPrize(prize: PrizeDto): Promise<void> {
    await this.repo.addPrizes([toPrize(prize)]);
  }

  async savePrize(
    prize: PrizeDto,
    tempAsset?: Asset,
    tempBgm1Asset?: Asset,
    tempBgm2Asset?: Asset
  ): Promise<Prize> {
    let assetId: string | undefined;
    if (tempAsset) {
      const updated = await this.driveDataService.addDriveData([tempAsset]);
      assetId = updated[0].id || undefined;
    }
    let bgm1AssetId: string | undefined;
    if (tempBgm1Asset) {
      const updated = await this.driveDataService.addDriveData([tempBgm1Asset]);
      bgm1AssetId = updated[0].id || undefined;
    }
    let bgm2AssetId: string | undefined;
    if (tempBgm2Asset) {
      const updated = await this.driveDataService.addDriveData([tempBgm2Asset]);
      bgm2AssetId = updated[0].id || undefined;
    }
    const prizeToSave = {
      ...prize,
      imageAssetId: assetId || prize.imageAssetId,
      bgm1AssetId: bgm1AssetId || prize.bgm1AssetId,
      bgm2AssetId: bgm2AssetId || prize.bgm2AssetId,
    };
    await this.repo.addPrizes([toPrize(prizeToSave)]);
    const addedPrize = toPrize(prizeToSave);
    if (tempAsset) {
      try {
        addedPrize.imageDataUrl = URL.createObjectURL(tempAsset.blob);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Failed to create object URL for prize image blob", e);
        addedPrize.imageDataUrl = "";
      }
    }
    return addedPrize;
  }

  async updatePrize(id: string, prize: PrizeDto): Promise<void> {
    const updateOps = [{ id, updateFn: (_: any) => toPrize(prize) }];
    await this.repo.updatePrizes(updateOps);
  }

  async deletePrize(id: string): Promise<void> {
    await this.repo.deletePrizes([id]);
  }

  async deletePrizes(ids: string[]): Promise<void> {
    await this.repo.deletePrizes(ids);
  }
}
