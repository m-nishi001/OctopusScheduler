import type { ScreenContent } from '../../domains/screen-content/ScreenContent';

export interface ScreenContentRepository {
  getScreenContentById(id: string): Promise<ScreenContent | null>;
  getAllScreenContents(): Promise<ScreenContent[]>;
}
