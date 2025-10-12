import { ScreenSetting } from "../screen-setting";

export interface IScreenConfigRepository {
  getScreenSettings(): Promise<ScreenSetting[]>;
  getScreenSettingsByType(type: string): Promise<ScreenSetting[]>;
  updateScreenSettings(settings: ScreenSetting[]): Promise<void>;
  syncScreenConfigs(): Promise<void>;
}
