import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { MainScreenSetting } from "../../../domains/screen-config/main-screen-setting";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class MainScreenConfigConverter implements IScreenConfigConverter {
  getType(): "main" {
    return "main";
  }

  toDto(settings: ScreenSetting[]): MainScreenSetting {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return MainScreenSetting.fromRecords(records);
  }

  toSettings(dto: MainScreenSetting): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
