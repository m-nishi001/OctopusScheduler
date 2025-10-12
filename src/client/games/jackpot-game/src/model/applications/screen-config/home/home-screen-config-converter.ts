import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { HomeScreenConfig } from "../../../domains/screen-config/home-screen-config";

export interface IScreenConfigConverter<T extends HomeScreenConfig> {
  toDto(settings: ScreenSetting[]): T;
  toSettings(dto: T): ScreenSetting[];
}

export class HomeScreenConfigConverter
  implements IScreenConfigConverter<HomeScreenConfig>
{
  toDto(settings: ScreenSetting[]): HomeScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return HomeScreenConfig.fromRecords(settings[0]?.id || "", records);
  }

  toSettings(dto: HomeScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.id, dto.type, key, value));
    }
    return settings;
  }
}
