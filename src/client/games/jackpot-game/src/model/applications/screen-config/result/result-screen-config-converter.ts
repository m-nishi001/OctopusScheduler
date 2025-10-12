import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { ResultScreenConfig } from "../../../domains/screen-config/result-screen-config";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class ResultScreenConfigConverter implements IScreenConfigConverter {
  getType(): "result" {
    return "result";
  }

  toDto(settings: ScreenSetting[]): ResultScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return ResultScreenConfig.fromRecords(records);
  }

  toSettings(dto: ResultScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
