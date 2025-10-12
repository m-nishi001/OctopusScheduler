import { injectable } from "tsyringe";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";
import type { IScreenSettingRepository } from "../../domains/screen-config/repository/i-screen-setting-repository";
import { useLocalStorage } from "../../../../../../packages/shared-composables/src/use-localstorage";
import { StorageConfig } from "../../infrastructures/storage-config";
import { ScreenSetting } from "../../domains/screen-config/screen-setting";

@injectable()
export class ScreenConfigRepository implements IScreenSettingRepository {
  private readonly localStorage = useLocalStorage(
    StorageConfig.getDbName(),
    StorageConfig.getStoreName("ScreenConfigData")
  );
  private readonly gasService = GasFunctionService.create("callJackpotGameApi");

  async getScreenSettings(): Promise<ScreenSetting[]> {
    const allSettings = await this.localStorage.getAll<ScreenSetting>();
    return Array.from(allSettings.values());
  }

  async getScreenSettingsByType(type: string): Promise<ScreenSetting[]> {
    const allSettings = await this.getScreenSettings();
    return allSettings.filter((setting) => setting.screenName === type);
  }

  async updateScreenSettings(settings: ScreenSetting[]): Promise<void> {
    if (this.gasService) {
      try {
        await new Promise<void>((resolve, reject) => {
          this.gasService!.createCall<void>(
            "ScreenConfigService.updateScreenConfig",
            settings
          )
            .withSuccessed(() => resolve())
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        });
        settings.forEach((setting) =>
          this.localStorage.save(
            setting.screenName + "_" + setting.settingName,
            setting
          )
        );
      } catch (e) {
        console.warn("Failed to save to GAS:", e);
      }
    }
  }

  async syncScreenConfigs(): Promise<void> {
    if (!this.gasService) throw new Error("GAS service not available");
    try {
      const settings: ScreenSetting[] = await new Promise<ScreenSetting[]>(
        (resolve, reject) => {
          this.gasService!.createCall<ScreenSetting[]>(
            "ScreenConfigService.getScreenConfigs"
          )
            .withSuccessed((res: ScreenSetting[]) => resolve(res))
            .withFailuered((msg: string) => reject(new Error(msg)))
            .invoke();
        }
      );
      settings.forEach((setting) =>
        this.localStorage.save(
          setting.screenName + "_" + setting.settingName,
          setting
        )
      );
    } catch (e) {
      console.warn("Failed to sync screen configs:", e);
    }
  }
}
