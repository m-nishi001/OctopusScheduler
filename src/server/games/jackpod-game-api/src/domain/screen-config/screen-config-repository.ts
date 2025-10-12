import { ScreenSetting } from "./screen-settings";

export interface IScreenConfigRepository {
  getScreenConfigs(): ScreenSetting[];
  updateScreenSettings(settings: ScreenSetting[]): void;
  deleteScreenConfigs(types: string[]): void;
  addScreenConfigs(configs: ScreenSetting[]): void;
}
