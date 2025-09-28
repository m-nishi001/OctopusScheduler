import type { ScreenConfig } from '../../../domains/screen-config/screen-config';

export interface IScreenConfigRepository {
  fetchScreenConfig(screenType: string): Promise<ScreenConfig>;
}
