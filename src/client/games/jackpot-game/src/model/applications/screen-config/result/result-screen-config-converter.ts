import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { ResultScreenConfig } from "../../../domains/screen-config/result-screen-config";

export interface IScreenConfigConverter<T> {
  toDto(settings: ScreenSetting[]): T;
  toSettings(dto: T): ScreenSetting[];
}

export class ResultScreenConfigConverter
  implements IScreenConfigConverter<ResultScreenConfig>
{
  toDto(settings: ScreenSetting[]): ResultScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return ResultScreenConfig.fromRecords(settings[0]?.id || "", records);
  }

  toSettings(dto: ResultScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.id, dto.type, key, value));
    }
    return settings;
  }
}
