import { injectable, inject, container } from "tsyringe";
import { AssetDataService } from "../asset/asset-data-service";
import { IScreenSettingRepositoryToken } from "../../domains/screen-config/repository/i-screen-setting-repository";
import type { Asset } from "../../domains/drive-data/asset-data";
import { ScreenSetting } from "../../domains/screen-config/screen-setting";
import type { IScreenSettingRepository } from "../../domains/screen-config/repository/i-screen-setting-repository";

@injectable()
export class ScreenSettingsService {
  private assetDataService: AssetDataService;

  constructor(
    @inject(IScreenSettingRepositoryToken)
    private repo: IScreenSettingRepository
  ) {
    // Resolve AssetDataService by class token (registrations should be
    // performed during app bootstrap). This avoids fragile string tokens.
    this.assetDataService = container.resolve(AssetDataService);
  }

  // Save a single setting JSON under a screen-specific key
  async saveScreenSetting(
    screenName: string,
    settingName: string,
    payload: any,
    tempAssets?: Asset[]
  ): Promise<void> {
    if (tempAssets && tempAssets.length > 0) {
      // Only add assets that don't already have an id. Callers that have
      // already uploaded assets will pass assets with ids and we should
      // avoid re-uploading / creating duplicates in local store.
      const toUpload = tempAssets.filter((a) => !a.id);
      if (toUpload.length > 0) {
        await this.assetDataService.addAssetData(toUpload);
      }
    }
    const converter = payload as any;
    // convert to ScreenSetting items expected by repository
    // We store as a single setting entry per screen/settingName
    const settingValue = JSON.stringify(this.sanitizeDates(converter));
    const ss = new ScreenSetting(screenName, settingName, settingValue);
    await this.repo.updateScreenSettings([ss]);
  }

  async fetchScreenSetting(
    screenName: string,
    settingName: string
  ): Promise<any | null> {
    const settings = await this.repo.getScreenSettingsByType(screenName);
    if (!settings || settings.length === 0) return null;
    // find by settingName
    const found = settings.find((s) => s.settingName === settingName);
    if (!found) return null;
    try {
      return JSON.parse(found.settingValue) as any;
    } catch (e) {
      return null;
    }
  }

  async listScreenSettings(screenName: string): Promise<any[]> {
    const settings = await this.repo.getScreenSettingsByType(screenName);
    return settings
      .map((s) => {
        try {
          return JSON.parse(s.settingValue) as any;
        } catch (e) {
          return null as any;
        }
      })
      .filter(Boolean) as any[];
  }

  // no local keys here; repository manages storage layout

  // convert Date objects to ISO strings recursively for safety
  private sanitizeDates(obj: any): any {
    if (obj == null) return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map((v) => this.sanitizeDates(v));
    if (typeof obj === "object") {
      const out: any = {};
      for (const k of Object.keys(obj)) {
        out[k] = this.sanitizeDates(obj[k]);
      }
      return out;
    }
    return obj;
  }

  // For now delegate sync to repo/service layers (no-op here); kept for parity
  async syncToDrive(
    onProgress?: (message: string) => void
  ): Promise<{ synced: number }> {
    // no-op; repo-level sync used elsewhere (ScreenConfigRepository currently no-op)
    onProgress?.("Sync not implemented on client service.");
    return { synced: 0 };
  }
}
