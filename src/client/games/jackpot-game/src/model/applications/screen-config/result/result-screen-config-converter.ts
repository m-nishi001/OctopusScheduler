import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { ResultScreenSetting } from "../../../domains/screen-config/result-screen-setting";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class ResultScreenConfigConverter implements IScreenConfigConverter {
  getType(): "result" {
    return "result";
  }

  toDto(settings: ScreenSetting[]): ResultScreenSetting {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return ResultScreenSetting.fromRecords(records);
  }

  toSettings(dto: ResultScreenSetting): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
