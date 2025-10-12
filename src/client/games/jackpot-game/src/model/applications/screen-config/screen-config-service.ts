import { injectable, inject } from "tsyringe";
import type { IScreenConfigRepository } from "../../domains/screen-config/repository/i-screen-config-repository";
import { ScreenSetting } from "../../domains/screen-config/screen-setting";
import { ScreenConfigConverterManager } from "./screen-config-converter-manager";
import type { IScreenConfig } from "../../domains/screen-config/i-screen-config";

@injectable()
export class ScreenConfigService {
  constructor(
    @inject("IScreenConfigRepository") private repo: IScreenConfigRepository,
    private converterManager: ScreenConfigConverterManager
  ) {}

  async fetchScreenConfig(screenType: string): Promise<ScreenSetting[]> {
    const settings = await this.repo.getScreenSettingsByType(screenType);
    return settings;
  }

  async saveScreenConfigs(dtos: IScreenConfig[]): Promise<void> {
    const allSettings: ScreenSetting[] = [];
    for (const dto of dtos) {
      const settings = this.converterManager.convertToSettings(dto);
      allSettings.push(...settings);
    }
    await this.repo.updateScreenSettings(allSettings);
  }

  async syncScreenConfigs(): Promise<void> {
    await this.repo.syncScreenConfigs();
  }

  convertToDto(type: string, settings: ScreenSetting[]): IScreenConfig | null {
    return this.converterManager.convertToDto(type, settings);
  }
}
