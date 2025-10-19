import { injectable, inject } from "tsyringe";
import type { IDriveDataRepository } from "../../domains/drive-data/repository/i-drive-data-repository";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";
import type { PrizeDto } from "./dto/prize-dto";
import { toPrize } from "./dto/prize-dto";
import type { AssetDataDto } from "../asset/dto/asset-data-dto";
import type { Prize } from "../../domains/prize/prize";

@injectable()
export class PrizeAddService {
  constructor(
    @inject("IDriveDataRepository") private driveDataRepo: IDriveDataRepository,
    @inject("IPrizeRepository") private prizeRepo: IPrizeRepository
  ) {}

  async savePrize(
    prize: PrizeDto,
    tempDriveDataDto?: AssetDataDto,
    tempBgm1DriveDataDto?: AssetDataDto,
    tempBgm2DriveDataDto?: AssetDataDto
  ): Promise<Prize> {
    let assetId: string | undefined;
    if (tempDriveDataDto) {
      const driveData = await this.driveDataRepo.addDriveData([
        await tempDriveDataDto.toDriveData(),
      ]);
      assetId = driveData[0];
    }
    let bgm1AssetId: string | undefined;
    if (tempBgm1DriveDataDto) {
      const driveData = await this.driveDataRepo.addDriveData([
        await tempBgm1DriveDataDto.toDriveData(),
      ]);
      bgm1AssetId = driveData[0];
    }
    let bgm2AssetId: string | undefined;
    if (tempBgm2DriveDataDto) {
      const driveData = await this.driveDataRepo.addDriveData([
        await tempBgm2DriveDataDto.toDriveData(),
      ]);
      bgm2AssetId = driveData[0];
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
        addedPrize.imageDataUrl = tempDriveDataDto.blob
          ? URL.createObjectURL(tempDriveDataDto.blob)
          : "";
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
