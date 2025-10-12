import { IScreenConfig } from "./IScreenConfig";

export interface IScreenConfigRepository {
  getScreenConfigs(): IScreenConfig[];
  getScreenConfigById(type: string): IScreenConfig | null;
  updateScreenConfigs(configs: IScreenConfig[]): void;
  deleteScreenConfigs(types: string[]): void;
  addScreenConfigs(configs: IScreenConfig[]): void;
}
