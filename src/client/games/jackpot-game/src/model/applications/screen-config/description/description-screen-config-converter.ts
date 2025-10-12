import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { DescriptionScreenConfig } from "../../../domains/screen-config/description-screen-config";

export interface IScreenConfigConverter<T> {
  toDto(settings: ScreenSetting[]): T;
  toSettings(dto: T): ScreenSetting[];
}

export class DescriptionScreenConfigConverter
  implements IScreenConfigConverter<DescriptionScreenConfig>
{
  toDto(settings: ScreenSetting[]): DescriptionScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return DescriptionScreenConfig.fromRecords(settings[0]?.id || "", records);
  }

  toSettings(dto: DescriptionScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.id, dto.type, key, value));
    }
    return settings;
  }
}
