import { injectable, container } from "tsyringe";
import type { IScreenSettingRepository } from "../domains/screen-config/repository/i-screen-setting-repository";
import { LocalStorageService } from "@common-lib/storage/local-storage-service";
import { ScreenSetting } from "../domains/screen-config/screen-setting";
import { GasFunctionService } from "@common-lib/google-apps-script/gas-script-service";
import { AssetDataService } from "../applications/asset/asset-data-service";
import type {
  DriveJsonData,
  DriveMetadata,
} from "../../../../../../server/common/src/drive-types";

@injectable()
export class ScreenConfigRepository implements IScreenSettingRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "ScreenConfigData"
  );

  private readonly assetService = container.resolve(AssetDataService);

  async getScreenSettings(): Promise<ScreenSetting[]> {
    const allSettings = await this.localStorage.getAll<ScreenSetting>();
    return Array.from(allSettings.values());
  }

  async getScreenSettingsByType(type: string): Promise<ScreenSetting[]> {
    const allSettings = await this.getScreenSettings();
    return allSettings.filter((setting) => setting.screenName === type);
  }

  async updateScreenSettings(settings: ScreenSetting[]): Promise<void> {
    settings.forEach((setting) =>
      this.localStorage.save(
        setting.screenName + "_" + setting.settingName,
        setting
      )
    );
  }

  async syncScreenConfigs(): Promise<{ synced: number }> {
    // Default sync behavior: perform download if a last-file-id is present,
    // otherwise return zero. BulkSync will orchestrate assets before calling
    // this when necessary.
    const lastId = localStorage.getItem("jackpot-screens-last-file-id");
    if (!lastId) return { synced: 0 };

    // First, ensure assets are synchronized and obtain idMap mapping old->new
    let idMap: { [oldId: string]: string } = {};
    try {
      const res = await (this.assetService as any).replaceLocalWithDrive();
      if (res && res.idMap) idMap = res.idMap as { [k: string]: string };
    } catch (e) {
      // proceed without idMap but warn
      console.warn("Asset sync for screen configs failed:", e);
    }

    try {
      const imported = await this.importScreenConfigsFromDrive(lastId, idMap);
      return { synced: imported.replaced };
    } catch (e) {
      console.error("Failed to import screen configs:", e);
      return { synced: 0 };
    }
  }

  // Export all screen settings as a single JSON file (screens.json) to Drive.
  async exportScreenConfigsToDrive(): Promise<DriveMetadata | null> {
    try {
      const all = await this.localStorage.getAll<ScreenSetting>();
      const entries: ScreenSetting[] = Array.from(all.values());
      const json = JSON.stringify(entries || []);

      const service = new GasFunctionService("addJson");
      const appFileId = String(Date.now()) + "-screens";
      const driveJson: DriveJsonData = {
        appFileId,
        metadata: {},
        fileName: "screens.json",
        jsonText: json,
        uploadDate: new Date().toISOString(),
        parentFolderId: "",
      } as any;

      const resp = await service.call<DriveMetadata>(driveJson as any);
      // store fileId if returned
      const fileId =
        (resp && (resp as any).fileId) ||
        (resp && (resp as any).data && (resp as any).data.fileId) ||
        null;
      if (fileId)
        localStorage.setItem("jackpot-screens-last-file-id", String(fileId));
      return resp || null;
    } catch (e) {
      console.error("exportScreenConfigsToDrive failed:", e);
      return null;
    }
  }

  // Import screen settings from Drive (single file). If idMap is provided,
  // replace referenced asset IDs in the JSON before persisting locally.
  async importScreenConfigsFromDrive(
    fileId?: string,
    idMap?: { [oldId: string]: string }
  ): Promise<{ replaced: number }> {
    try {
      const service = new GasFunctionService("getJson");
      const resp = await service.call<{ json: string }>(
        fileId || localStorage.getItem("jackpot-screens-last-file-id") || ""
      );
      const payloadJson =
        (resp && (resp as any).json) ||
        (resp && (resp as any).data && (resp as any).data.json) ||
        null;
      if (!payloadJson)
        throw new Error("No json payload returned from getJson");

      const parsed = JSON.parse(payloadJson) as ScreenSetting[];
      if (!Array.isArray(parsed))
        throw new Error("Downloaded screens JSON is not an array");

      // Apply idMap replacements if provided
      if (idMap && Object.keys(idMap).length > 0) {
        for (const s of parsed) {
          try {
            const obj = JSON.parse(s.settingValue || "null");
            const replaced = this.replaceAssetIdsInObject(obj, idMap);
            (s as any).settingValue = JSON.stringify(replaced);
          } catch (e) {
            console.warn(
              "Failed to parse/replace asset ids for screen setting",
              s.settingName,
              e
            );
          }
        }
      }

      // Replace local storage atomically
      const all = await this.localStorage.getAll();
      const keys = Array.from(all.keys());
      if (keys.length) await this.localStorage.removeMultiple(keys);
      for (const s of parsed) {
        const key = s.screenName + "_" + s.settingName;
        await this.localStorage.save(key, s);
      }

      return { replaced: parsed.length };
    } catch (e) {
      console.error("importScreenConfigsFromDrive failed:", e);
      throw e;
    }
  }

  // Recursively replace any string values that match old asset ids with new ones.
  // This is conservative: only replaces exact matches of id strings.
  private replaceAssetIdsInObject(
    obj: any,
    idMap: { [oldId: string]: string }
  ): any {
    if (obj == null) return obj;
    if (Array.isArray(obj))
      return obj.map((v) => this.replaceAssetIdsInObject(v, idMap));
    if (typeof obj === "object") {
      const out: any = {};
      for (const k of Object.keys(obj)) {
        out[k] = this.replaceAssetIdsInObject(obj[k], idMap);
      }
      return out;
    }
    if (typeof obj === "string") {
      // simple direct replacement if the string equals an old id
      if (idMap[obj]) return idMap[obj];
      return obj;
    }
    return obj;
  }
}
