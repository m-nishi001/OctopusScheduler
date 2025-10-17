import { injectable, inject } from "tsyringe";
import type { IDriveDataRepository } from "../../domains/drive-data/repository/i-drive-data-repository";
import type { IPrizeRepository } from "../../domains/prize/repository/i-prize-repository";
import type { PrizeDto } from "./dto/prize-dto";
import { toPrize } from "./dto/prize-dto";
import type { DriveDataDto } from "../asset/dto/drive-data-dto";
import type { Prize } from "../../domains/prize/prize";

@injectable()
export class PrizeAddService {
  constructor(
    @inject("IDriveDataRepository") private driveDataRepo: IDriveDataRepository,
    @inject("IPrizeRepository") private prizeRepo: IPrizeRepository
  ) {}

  async savePrize(
    prize: PrizeDto,
    tempDriveDataDto?: DriveDataDto,
    tempBgm1DriveDataDto?: DriveDataDto,
    tempBgm2DriveDataDto?: DriveDataDto
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
      addedPrize.imageDataUrl = tempDriveDataDto.dataUrl;
    }
    return addedPrize;
  }
}
