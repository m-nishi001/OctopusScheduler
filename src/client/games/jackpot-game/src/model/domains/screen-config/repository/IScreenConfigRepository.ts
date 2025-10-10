import type { ScreenConfig } from "../screen-config";

export interface IScreenConfigRepository {
  getScreenConfigs(): Promise<ScreenConfig[]>;
  getScreenConfigById(type: string): Promise<ScreenConfig | null>;
  updateScreenConfigs(configs: ScreenConfig[]): Promise<void>;
  deleteScreenConfigs(types: string[]): Promise<void>;
  addScreenConfigs(configs: ScreenConfig[]): Promise<void>;
}
