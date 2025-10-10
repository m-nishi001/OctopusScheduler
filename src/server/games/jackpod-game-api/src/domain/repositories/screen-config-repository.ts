import { ScreenConfig } from "../entities/screen-config";

export interface IScreenConfigRepository {
  getScreenConfigs(): ScreenConfig[];
  getScreenConfigById(type: string): ScreenConfig | null;
  updateScreenConfigs(configs: ScreenConfig[]): void;
  deleteScreenConfigs(types: string[]): void;
  addScreenConfigs(configs: ScreenConfig[]): void;
}
