import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { DescriptionScreenSetting } from "../../../domains/screen-config/description-screen-setting";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class DescriptionScreenConfigConverter
  implements IScreenConfigConverter
{
  getType(): "description" {
    return "description";
  }

  toDto(settings: ScreenSetting[]): DescriptionScreenSetting {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return DescriptionScreenSetting.fromRecords(records);
  }

  toSettings(dto: DescriptionScreenSetting): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
