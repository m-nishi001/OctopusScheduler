import { injectable, inject } from "tsyringe";
import { AssetDataService } from "../asset/asset-data-service";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";
import type { PrizeDto } from "./dto/prize-dto";
import { toPrize } from "./dto/prize-dto";
import type { Asset } from "../../domains/drive-data/asset-data";
import type { Prize } from "../../domains/prize/prize";

@injectable()
export class PrizeAddService {
  constructor(
    @inject("DriveDataService") private driveDataService: AssetDataService,
    @inject("IPrizeRepository") private prizeRepo: IPrizeRepository
  ) {}

  async savePrize(
    prize: PrizeDto,
    tempDriveDataDto?: Asset,
    tempBgm1DriveDataDto?: Asset,
    tempBgm2DriveDataDto?: Asset
  ): Promise<Prize> {
    let assetId: string | undefined;
    if (tempDriveDataDto) {
      const updated = await this.driveDataService.addDriveData([
        tempDriveDataDto,
      ]);
      assetId = updated[0].id || undefined;
    }
    let bgm1AssetId: string | undefined;
    if (tempBgm1DriveDataDto) {
      const updated = await this.driveDataService.addDriveData([
        tempBgm1DriveDataDto,
      ]);
      bgm1AssetId = updated[0].id || undefined;
    }
    let bgm2AssetId: string | undefined;
    if (tempBgm2DriveDataDto) {
      const updated = await this.driveDataService.addDriveData([
        tempBgm2DriveDataDto,
      ]);
      bgm2AssetId = updated[0].id || undefined;
    }
    const prizeToSave = {
      ...prize,
      imageAssetId: assetId || prize.imageAssetId,
      bgm1AssetId: bgm1AssetId || prize.bgm1AssetId,
      bgm2AssetId: bgm2AssetId || prize.bgm2AssetId,
    };
    await this.prizeRepo.addPrizes([toPrize(prizeToSave)]);
    const addedPrize = toPrize(prizeToSave);
    if (tempDriveDataDto) {
      // For UI convenience store an object URL created from the blob so
      // components can preview without reading an inline data URL.
      try {
        addedPrize.imageDataUrl = URL.createObjectURL(tempDriveDataDto.blob);
      } catch (e) {
        // fallback to empty string if object URL creation fails
        // eslint-disable-next-line no-console
        console.warn("Failed to create object URL for prize image blob", e);
        addedPrize.imageDataUrl = "";
      }
    }
    return addedPrize;
  }
}
