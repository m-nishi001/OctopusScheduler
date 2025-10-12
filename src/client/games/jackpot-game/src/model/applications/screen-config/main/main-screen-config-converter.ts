import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { MainScreenConfig } from "../../../domains/screen-config/main-screen-config";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class MainScreenConfigConverter implements IScreenConfigConverter {
  getType(): "main" {
    return "main";
  }

  toDto(settings: ScreenSetting[]): MainScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return MainScreenConfig.fromRecords(records);
  }

  toSettings(dto: MainScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
