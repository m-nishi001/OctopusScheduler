import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { HomeScreenSetting } from "../../../domains/screen-config/home-screen-setting";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class HomeScreenConfigConverter implements IScreenConfigConverter {
  getType(): "home" {
    return "home";
  }

  toDto(settings: ScreenSetting[]): HomeScreenSetting {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return HomeScreenSetting.fromRecords(records);
  }

  toSettings(dto: HomeScreenSetting): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
