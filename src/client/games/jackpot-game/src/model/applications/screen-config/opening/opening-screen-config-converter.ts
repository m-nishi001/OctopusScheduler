import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { OpeningScreenConfig } from "../../../domains/screen-config/opening-screen-config";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class OpeningScreenConfigConverter implements IScreenConfigConverter {
  getType(): "opening" {
    return "opening";
  }

  toDto(settings: ScreenSetting[]): OpeningScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return OpeningScreenConfig.fromRecords(settings[0]?.id || "", records);
  }

  toSettings(dto: OpeningScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.id, dto.type, key, value));
    }
    return settings;
  }
}
