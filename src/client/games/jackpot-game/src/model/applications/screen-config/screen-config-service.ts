import { injectable, inject } from "tsyringe";
import type { IScreenSettingRepository } from "../../domains/screen-config/repository/i-screen-setting-repository";
import { ScreenSetting } from "../../domains/screen-config/screen-setting";
import type { IScreenSetting } from "../../domains/screen-config/i-screen-setting";
import {
  IScreenConfigConverterToken,
  type IScreenConfigConverter,
} from "./i-screen-config-converter";
import { container } from "tsyringe";
import { AssetDataService } from "../asset/asset-data-service";
import type { Asset } from "../../domains/drive-data/asset-data";

@injectable()
export class ScreenConfigService {
  constructor(
    @inject("IScreenSettingRepository") private repo: IScreenSettingRepository,
    private driveDataService: AssetDataService
  ) {}

  async fetchScreenConfig(type: string): Promise<IScreenSetting | null> {
    const settings = await this.repo.getScreenSettingsByType(type);
    const converters = container.resolveAll<IScreenConfigConverter>(
      IScreenConfigConverterToken
    );
    const converter = converters.find((c) => c.getType() === type);
    if (converter) {
      return converter.toDto(settings);
    }
    return null;
  }

  async saveScreenConfigs(
    settings: ScreenSetting[],
    tempAssets?: Asset[]
  ): Promise<void> {
    if (tempAssets && tempAssets.length > 0) {
      await this.driveDataService.addDriveData(tempAssets);
    }
    await this.repo.updateScreenSettings(settings);
  }

  async syncScreenConfigs(): Promise<{ synced: number }> {
    return await this.repo.syncScreenConfigs();
  }
}
