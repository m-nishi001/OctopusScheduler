import type { IScreenConfig } from "../i-screen-config";

export interface IScreenConfigRepository {
  getScreenConfigs(): Promise<IScreenConfig[]>;
  getScreenConfigById(type: string): Promise<IScreenConfig | null>;
  updateScreenConfigs(configs: IScreenConfig[]): Promise<void>;
  deleteScreenConfigs(types: string[]): Promise<void>;
  syncScreenConfigs(): Promise<void>;
}
