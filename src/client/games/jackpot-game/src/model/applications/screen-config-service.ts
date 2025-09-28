
import { injectable, inject } from 'tsyringe';
import type { IScreenConfigRepository } from '../domains/screen-config/repository/IScreenConfigRepository';
import type { ScreenConfig } from '../../model/domains/screen-config/screen-config';

@injectable()
export class ScreenConfigService {
  constructor(@inject("IScreenConfigRepository") private repo: IScreenConfigRepository) {}

  async fetchScreenConfig(screenType: string): Promise<ScreenConfig> {
    return await this.repo.fetchScreenConfig(screenType);
  }
}
