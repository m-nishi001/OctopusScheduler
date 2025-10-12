import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { EndingScreenSetting } from "../../../domains/screen-config/ending-screen-setting";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class EndingScreenConfigConverter implements IScreenConfigConverter {
  getType(): "ending" {
    return "ending";
  }

  toDto(settings: ScreenSetting[]): EndingScreenSetting {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return EndingScreenSetting.fromRecords(records);
  }

  toSettings(dto: EndingScreenSetting): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
