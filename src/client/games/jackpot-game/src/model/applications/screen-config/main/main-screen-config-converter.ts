import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { MainScreenConfig } from "../../../domains/screen-config/main-screen-config";

export interface IScreenConfigConverter<T> {
  toDto(settings: ScreenSetting[]): T;
  toSettings(dto: T): ScreenSetting[];
}

export class MainScreenConfigConverter
  implements IScreenConfigConverter<MainScreenConfig>
{
  toDto(settings: ScreenSetting[]): MainScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return MainScreenConfig.fromRecords(settings[0]?.id || "", records);
  }

  toSettings(dto: MainScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.id, dto.type, key, value));
    }
    return settings;
  }
}
