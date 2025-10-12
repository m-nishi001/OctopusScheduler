import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { DescriptionScreenConfig } from "../../../domains/screen-config/description-screen-config";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class DescriptionScreenConfigConverter
  implements IScreenConfigConverter
{
  getType(): "description" {
    return "description";
  }

  toDto(settings: ScreenSetting[]): DescriptionScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return DescriptionScreenConfig.fromRecords(records);
  }

  toSettings(dto: DescriptionScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
