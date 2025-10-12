import { injectable } from "tsyringe";
import { ScreenSetting } from "../../../domains/screen-config/screen-setting";
import { DemoScreenConfig } from "../../../domains/screen-config/demo-screen-config";
import type { IScreenConfigConverter } from "../i-screen-config-converter";

@injectable()
export class DemoScreenConfigConverter implements IScreenConfigConverter {
  getType(): "demo" {
    return "demo";
  }

  toDto(settings: ScreenSetting[]): DemoScreenConfig {
    const records = new Map<string, string>();
    for (const setting of settings) {
      records.set(setting.settingName, setting.settingValue);
    }
    return DemoScreenConfig.fromRecords(records);
  }

  toSettings(dto: DemoScreenConfig): ScreenSetting[] {
    const settings: ScreenSetting[] = [];
    for (const [key, value] of dto.toRecords()) {
      settings.push(new ScreenSetting(dto.type, key, value));
    }
    return settings;
  }
}
