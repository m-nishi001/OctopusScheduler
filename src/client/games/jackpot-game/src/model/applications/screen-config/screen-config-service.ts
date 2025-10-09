import { injectable, inject } from "tsyringe";
import type { IScreenConfigRepository } from "../../domains/screen-config/repository/IScreenConfigRepository";
import type { IAssetRepository } from "../../domains/asset/repository/IAssetRepository";
import type { ScreenConfigDto } from "./dto/screen-config-dto";

@injectable()
export class ScreenConfigService {
  constructor(
    @inject("IScreenConfigRepository") private repo: IScreenConfigRepository,
    @inject("IAssetRepository") private assetRepo: IAssetRepository
  ) {}

  async fetchScreenConfig(screenType: string): Promise<ScreenConfigDto> {
    const config = await this.repo.fetchScreenConfig(screenType);
    // By default, resolve asset IDs to data URLs and replace placeholders.
    // Callers may request the raw config (no resolution) by passing options.resolveAssets = false.
    // (We keep the original behavior as default for runtime consumers.)
    return this.resolveAssetsInConfig(config, true);
  }

  /**
   * Fetch screen config with optional asset resolution.
   * If resolveAssets is false, returns the raw config as stored (no dataUrl substitution
   * and no placeholder replacement). If true, returns the resolved form used at runtime.
   */
  async fetchScreenConfigWithOptions(
    screenType: string,
    options?: { resolveAssets?: boolean }
  ): Promise<ScreenConfigDto> {
    const config = await this.repo.fetchScreenConfig(screenType);
    const resolve = options?.resolveAssets ?? true;
    return this.resolveAssetsInConfig(config, resolve);
  }

  private async resolveAssetsInConfig(
    config: any,
    resolveAssets: boolean
  ): Promise<ScreenConfigDto> {
    const resolvedConfig: ScreenConfigDto = {
      ...config,
      bgmAssetUrl: undefined,
      seAssetUrls: [],
      elements: [],
    };

    if (!resolveAssets) {
      // Return raw config (no asset dataUrl resolution, no placeholder replacement)
      resolvedConfig.elements = config.elements || [];
      return resolvedConfig;
    }

    if (config.bgmAssetId) {
      const bgmAsset = await this.assetRepo.getAssetById(config.bgmAssetId);
      resolvedConfig.bgmAssetUrl = bgmAsset?.dataUrl;
    }

    if (config.seAssetIds) {
      resolvedConfig.seAssetUrls = await Promise.all(
        config.seAssetIds.map(async (id: string) => {
          const asset = await this.assetRepo.getAssetById(id);
          return asset?.dataUrl || "";
        })
      );
    }

    resolvedConfig.elements = await Promise.all(
      (config.elements || []).map(async (element: any) => {
        if (element.assetId) {
          const asset = await this.assetRepo.getAssetById(element.assetId);
          return { ...element, assetUrl: asset?.dataUrl };
        }
        return element;
      })
    );

    // Resolve inline placeholders in element.content like {asset:ASSET_ID} -> <img|video|audio ...>
    const allAssets = await this.assetRepo.fetchAssets();
    const assetMap = new Map(allAssets.map((a: any) => [a.id, a]));
    resolvedConfig.elements = resolvedConfig.elements.map((el: any) => {
      if (!el.content || typeof el.content !== "string") return el;
      const replaced = el.content.replace(
        /\{asset:([a-zA-Z0-9_-]+)\}/g,
        (_m: string, aid: string) => {
          const a = assetMap.get(aid);
          if (!a) return "";
          if (a.type === "image")
            return `<img src="${a.dataUrl}" alt="${a.name}" />`;
          if (a.type === "video")
            return `<video src="${a.dataUrl}" controls></video>`;
          if (a.type === "audio")
            return `<audio src="${a.dataUrl}" controls></audio>`;
          return "";
        }
      );
      return { ...el, content: replaced };
    });

    return resolvedConfig;
  }

  async saveScreenConfigs(configs: ScreenConfigDto[]): Promise<void> {
    await this.repo.saveScreenConfigs(configs);
  }

  async syncScreenConfigs(): Promise<void> {
    if (typeof this.repo.syncScreenConfigs === "function") {
      try {
        await this.repo.syncScreenConfigs();
      } catch (e) {
        // swallow error: sync is best-effort
      }
    }
  }
}
