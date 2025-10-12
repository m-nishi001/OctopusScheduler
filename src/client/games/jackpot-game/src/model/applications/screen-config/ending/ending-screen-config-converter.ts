import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { EndingScreenConfig } from "../../../domains/screen-config/ending-screen-config";

export interface IScreenConfigConverter<T> {
  toDto(settings: ScreenSetting[]): T;
  toSettings(dto: T): ScreenSetting[];
}

export class EndingScreenConfigConverter
  implements IScreenConfigConverter<EndingScreenConfig>
{
  toDto(settings: ScreenSetting[]): EndingScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return EndingScreenConfig.fromRecords(settings[0]?.id || "", records);
  }

  toSettings(dto: EndingScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.id, dto.type, key, value));
    }
    return settings;
  }
}
