import { injectable } from "tsyringe";
import type { IScreenSettingRepository } from "../domains/screen-config/repository/i-screen-setting-repository";
import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";
import { ScreenSetting } from "../domains/screen-config/screen-setting";

@injectable()
export class ScreenConfigRepository implements IScreenSettingRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "ScreenConfigData"
  );

  async getScreenSettings(): Promise<ScreenSetting[]> {
    const allSettings = await this.localStorage.getAll<ScreenSetting>();
    return Array.from(allSettings.values());
  }

  async getScreenSettingsByType(type: string): Promise<ScreenSetting[]> {
    const allSettings = await this.getScreenSettings();
    return allSettings.filter((setting) => setting.screenName === type);
  }

  async updateScreenSettings(settings: ScreenSetting[]): Promise<void> {
    settings.forEach((setting) =>
      this.localStorage.save(
        setting.screenName + "_" + setting.settingName,
        setting
      )
    );
  }

  async syncScreenConfigs(): Promise<{ synced: number }> {
    // GAS sync removed
    return { synced: 0 };
  }
}
