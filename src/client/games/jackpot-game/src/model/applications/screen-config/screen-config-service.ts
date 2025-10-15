import { injectable, inject } from "tsyringe";
import type { IScreenSettingRepository } from "../../domains/screen-config/repository/i-screen-setting-repository";
import { ScreenSetting } from "../../domains/screen-config/screen-setting";
import type { IScreenSetting } from "../../domains/screen-config/i-screen-setting";
import {
  IScreenConfigConverterToken,
  type IScreenConfigConverter,
} from "./i-screen-config-converter";
import { container } from "tsyringe";
import { AssetService } from "../asset/asset-service";
import type { AssetDto } from "../asset/dto/asset-dto";

@injectable()
export class ScreenConfigService {
  constructor(
    @inject("IScreenSettingRepository") private repo: IScreenSettingRepository,
    private assetService: AssetService
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
    tempAssets?: AssetDto[]
  ): Promise<void> {
    if (tempAssets && tempAssets.length > 0) {
      await this.assetService.addAssets(tempAssets);
    }
    await this.repo.updateScreenSettings(settings);
  }

  async syncScreenConfigs(): Promise<void> {
    await this.repo.syncScreenConfigs();
  }
}
