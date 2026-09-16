import { ScreenSetting } from "../screen-setting";

// Runtime DI token for IScreenSettingRepository. Use this exported Symbol
// when registering or injecting the repository to avoid brittle string tokens
// while keeping the compile-time interface type.
export const IScreenSettingRepositoryToken = Symbol("IScreenSettingRepository");

export interface IScreenSettingRepository {
  getScreenSettings(): Promise<ScreenSetting[]>;
  getScreenSettingsByType(type: string): Promise<ScreenSetting[]>;
  updateScreenSettings(settings: ScreenSetting[]): Promise<void>;
  syncScreenConfigs(): Promise<{ synced: number }>;
}
