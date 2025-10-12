import { ScreenSetting } from "../screen-setting";

export interface IScreenSettingRepository {
  getScreenSettings(): Promise<ScreenSetting[]>;
  getScreenSettingsByType(type: string): Promise<ScreenSetting[]>;
  updateScreenSettings(settings: ScreenSetting[]): Promise<void>;
  syncScreenConfigs(): Promise<void>;
}
