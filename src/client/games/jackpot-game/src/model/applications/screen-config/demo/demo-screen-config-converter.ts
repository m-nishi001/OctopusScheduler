import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { DemoScreenConfig } from "../../../domains/screen-config/demo-screen-config";

export interface IScreenConfigConverter<T> {
  toDto(settings: ScreenSetting[]): T;
  toSettings(dto: T): ScreenSetting[];
}

export class DemoScreenConfigConverter
  implements IScreenConfigConverter<DemoScreenConfig>
{
  toDto(settings: ScreenSetting[]): DemoScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return DemoScreenConfig.fromRecords(settings[0]?.id || "", records);
  }

  toSettings(dto: DemoScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.id, dto.type, key, value));
    }
    return settings;
  }
}
