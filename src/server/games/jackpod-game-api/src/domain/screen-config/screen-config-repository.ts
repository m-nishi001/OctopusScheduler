import { ScreenSettings } from "./screen-settings";

export interface IScreenConfigRepository {
  getScreenConfigs(): ScreenSettings;
  updateScreenSettings(settings: ScreenSettings): void;
  deleteScreenConfigs(types: string[]): void;
  addScreenConfigs(configs: ScreenSettings): void;
}
