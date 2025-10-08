import { ScreenConfig } from "../entities/screen-config";

export interface IScreenConfigRepository {
  createScreenConfigs(configs: ScreenConfig[]): void;
  updateScreenConfigs(configs: ScreenConfig[]): void;
  deleteScreenConfig(type: string): void;
  getScreenConfig(): ScreenConfig | null;
  findAll(): ScreenConfig[];
  findByType(type: string): ScreenConfig | null;
  update(
    type: string,
    updateEntity: (config: ScreenConfig) => ScreenConfig
  ): number;
  updateMany(
    types: string[],
    updateEntity: (config: ScreenConfig) => ScreenConfig
  ): number;
  delete(type: string): void;
  deleteMany(types: string[]): void;
}
