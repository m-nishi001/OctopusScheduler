import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { OpeningScreenSetting } from "../../../domains/screen-config/opening-screen-setting";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class OpeningScreenConfigConverter implements IScreenConfigConverter {
  getType(): "opening" {
    return "opening";
  }

  toDto(settings: ScreenSetting[]): OpeningScreenSetting {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return OpeningScreenSetting.fromRecords(records);
  }

  toSettings(dto: OpeningScreenSetting): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
