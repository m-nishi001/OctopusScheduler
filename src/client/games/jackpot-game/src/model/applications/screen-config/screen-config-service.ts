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
    const config = await this.repo.getScreenConfigById(screenType);
    if (!config) throw new Error(`Screen config not found: ${screenType}`);
    return this.resolveAssetsInConfig(config, true);
  }

  async fetchScreenConfigWithOptions(
    screenType: string,
    options?: { resolveAssets?: boolean }
  ): Promise<ScreenConfigDto> {
    const config = await this.repo.getScreenConfigById(screenType);
    if (!config) throw new Error(`Screen config not found: ${screenType}`);
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

    const allAssets = await this.assetRepo.getAssets();
    const assetMap = new Map(allAssets.map((a) => [a.id, a]));
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
    await this.repo.updateScreenConfigs(
      configs.map((c) => ({ ...c, id: c.type }) as any)
    );
  }

  async syncScreenConfigs(): Promise<void> {
    // サーバーから全画面設定を取得してローカルストレージに同期
    await this.repo.syncScreenConfigs();
  }
}
