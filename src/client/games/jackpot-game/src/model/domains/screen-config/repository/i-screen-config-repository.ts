import type { IScreenConfig } from "../i-screen-config";
import { ScreenSetting } from "../screen-setting";

export interface IScreenConfigRepository {
  getScreenConfigs(): Promise<IScreenConfig[]>;
  getScreenConfigById(type: string): Promise<IScreenConfig | null>;
  getScreenSettings(): Promise<ScreenSetting[]>;
  getScreenSettingsByType(type: string): Promise<ScreenSetting[]>;
  updateScreenConfigs(configs: IScreenConfig[]): Promise<void>;
  updateScreenSettings(settings: ScreenSetting[]): Promise<void>;
  deleteScreenConfigs(types: string[]): Promise<void>;
  syncScreenConfigs(): Promise<void>;
}
