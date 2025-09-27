import { ScreenConfig } from '../entities/screen-config';

export interface ScreenConfigRepository {
  saveScreenConfig(config: ScreenConfig): Promise<void>;
  getScreenConfig(): Promise<ScreenConfig | null>;
  findAll(): Promise<ScreenConfig[]>;
  findByType(type: string): Promise<ScreenConfig | null>;
  update(type: string, updateEntity: (config: ScreenConfig) => ScreenConfig): Promise<number>;
  updateMany(types: string[], updateEntity: (config: ScreenConfig) => ScreenConfig): Promise<number>;
  delete(type: string): Promise<void>;
  deleteMany(types: string[]): Promise<void>;
}
