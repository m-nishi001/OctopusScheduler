import { injectable, inject } from "tsyringe";
import type { IScreenConfigRepository } from "../domains/screen-config/repository/IScreenConfigRepository";
import type { IAssetRepository } from "../domains/asset/repository/IAssetRepository";
import type { ScreenConfigDto } from "./dto/screen-config-dto";

@injectable()
export class ScreenConfigService {
  constructor(
    @inject("IScreenConfigRepository") private repo: IScreenConfigRepository,
    @inject("IAssetRepository") private assetRepo: IAssetRepository
  ) {}

  async fetchScreenConfig(screenType: string): Promise<ScreenConfigDto> {
    const config = await this.repo.fetchScreenConfig(screenType);
    // アセットIDをURLに解決
    const resolvedConfig: ScreenConfigDto = {
      ...config,
      bgmAssetUrl: undefined,
      seAssetUrls: [],
      elements: [],
    };

    if (config.bgmAssetId) {
      const bgmAsset = await this.assetRepo.getAssetById(config.bgmAssetId);
      resolvedConfig.bgmAssetUrl = bgmAsset?.url;
    }

    if (config.seAssetIds) {
      resolvedConfig.seAssetUrls = await Promise.all(
        config.seAssetIds.map(async (id) => {
          const asset = await this.assetRepo.getAssetById(id);
          return asset?.url || "";
        })
      );
    }

    resolvedConfig.elements = await Promise.all(
      config.elements.map(async (element) => {
        if (element.assetId) {
          const asset = await this.assetRepo.getAssetById(element.assetId);
          return { ...element, assetUrl: asset?.url };
        }
        return element;
      })
    );

    return resolvedConfig;
  }
}
