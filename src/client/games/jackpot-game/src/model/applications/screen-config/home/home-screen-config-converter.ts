import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { HomeScreenConfig } from "../../../domains/screen-config/home-screen-config";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class HomeScreenConfigConverter implements IScreenConfigConverter {
  getType(): "home" {
    return "home";
  }

  toDto(settings: ScreenSetting[]): HomeScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return HomeScreenConfig.fromRecords(records);
  }

  toSettings(dto: HomeScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
