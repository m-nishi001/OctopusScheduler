import { injectable, inject } from "tsyringe";
import type { IScreenConfigRepository } from "../../domains/screen-config/repository/IScreenConfigRepository";
import type { IScreenConfig } from "../../domains/screen-config/IScreenConfig";

@injectable()
export class ScreenConfigService {
  constructor(
    @inject("IScreenConfigRepository") private repo: IScreenConfigRepository
  ) {}

  async fetchScreenConfig(screenType: string): Promise<IScreenConfig> {
    const config = await this.repo.getScreenConfigById(screenType);
    if (!config) throw new Error(`Screen config not found: ${screenType}`);
    return config;
  }

  async fetchScreenConfigWithOptions(
    screenType: string
  ): Promise<IScreenConfig> {
    const config = await this.repo.getScreenConfigById(screenType);
    if (!config) throw new Error(`Screen config not found: ${screenType}`);
    return config;
  }

  async saveScreenConfigs(configs: IScreenConfig[]): Promise<void> {
    await this.repo.updateScreenConfigs(configs);
  }

  async syncScreenConfigs(): Promise<void> {
    await this.repo.syncScreenConfigs();
  }
}
