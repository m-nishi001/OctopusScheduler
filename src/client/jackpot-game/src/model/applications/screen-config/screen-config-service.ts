import { injectable, inject } from "tsyringe";
import type { IScreenSettingRepository } from "../../domains/screen-config/repository/i-screen-setting-repository";
import { IScreenSettingRepositoryToken } from "../../domains/screen-config/repository/i-screen-setting-repository";
import { ScreenSetting } from "../../domains/screen-config/screen-setting";
import { AssetDataService } from "../asset/asset-data-service";
import type { Asset } from "../../domains/drive-data/asset-data";

@injectable()
export class ScreenConfigService {
  constructor(
    @inject(IScreenSettingRepositoryToken)
    private repo: IScreenSettingRepository,
    @inject(AssetDataService) private assetDataService: AssetDataService
  ) {}

  async fetchScreenConfig(type: string): Promise<any | null> {
    const settings = await this.repo.getScreenSettingsByType(type);
    if (!settings || settings.length === 0) return null;
    // Prefer the explicitly named setting saved by the admin UI, otherwise fallback to first
    const named =
      settings.find((s) => s.settingName === `${type}-screen-settings`) ||
      settings[0];
    try {
      return JSON.parse(named.settingValue || "null") as any;
    } catch (e) {
      console.error("Failed to parse screen setting value:", e);
      return null;
    }
  }

  async saveScreenConfigs(
    settings: ScreenSetting[],
    tempAssets?: Asset[]
  ): Promise<void> {
    if (tempAssets && tempAssets.length > 0) {
      await this.assetDataService.addAssetData(tempAssets);
    }
    await this.repo.updateScreenSettings(settings);
  }

  async syncScreenConfigs(): Promise<{ synced: number }> {
    return await this.repo.syncScreenConfigs();
  }
}
