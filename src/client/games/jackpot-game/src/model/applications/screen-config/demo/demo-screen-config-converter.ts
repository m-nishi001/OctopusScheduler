import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { DemoScreenSetting } from "../../../domains/screen-config/demo-screen-setting";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class DemoScreenConfigConverter implements IScreenConfigConverter {
  getType(): "demo" {
    return "demo";
  }

  toDto(settings: ScreenSetting[]): DemoScreenSetting {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return DemoScreenSetting.fromRecords(records);
  }

  toSettings(dto: DemoScreenSetting): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
