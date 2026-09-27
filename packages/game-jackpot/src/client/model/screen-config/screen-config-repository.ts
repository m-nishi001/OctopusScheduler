import { injectable, inject } from "tsyringe";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { DirtyTracker } from "@octopus/sync-engine";
import type { SyncTarget } from "@octopus/sync-engine";
import { ScreenSetting } from "./screen-setting";
import { IJackpotGameApiToken } from "../../../server/jackpot-api-contract";
import type { JackpotGameApi } from "../../../server/jackpot-api-contract";
import type { DriveJsonData } from "@octopus/infrastructures/compositions";

const SYNC_KIND = "screens";
const DRIVE_FILE_NAME = "screens.json";
// getJsonBlobの「fileId省略時は既定ファイル(prizes.json)」というフォールバックは
// このファイル名には効かないため、pushで得たfileId(フルキー)をこのブラウザに
// 保存しておき、次回以降はそれを明示的に渡す。
const DRIVE_FILE_ID_STORAGE_KEY = "jackpot-screens-last-file-id";

@injectable()
export class ScreenConfigRepository {
  private readonly localStorage = new LocalStorageService(
    "jackpot-game",
    "ScreenConfigData"
  );
  private readonly dirtyTracker = new DirtyTracker("jackpot-game");

  constructor(
    @inject(IJackpotGameApiToken) private readonly jackpotApi: JackpotGameApi
  ) {}

  async getScreenSettings(): Promise<ScreenSetting[]> {
    const allSettings = await this.localStorage.getAll<ScreenSetting>();
    return Array.from(allSettings.values());
  }

  async getScreenSettingsByType(type: string): Promise<ScreenSetting[]> {
    const allSettings = await this.getScreenSettings();
    return allSettings.filter((setting) => setting.screenName === type);
  }

  async updateScreenSettings(settings: ScreenSetting[]): Promise<void> {
    for (const setting of settings) {
      await this.localStorage.save(
        setting.screenName + "_" + setting.settingName,
        setting
      );
    }
    await this.dirtyTracker.touch(SYNC_KIND);
    eventBus.emit("syncDirty");
  }

  private async replaceAllScreenSettings(settings: ScreenSetting[]): Promise<void> {
    const all = await this.localStorage.getAll();
    const keys = Array.from(all.keys());
    if (keys.length) await this.localStorage.removeMultiple(keys);
    for (const s of settings) {
      await this.localStorage.save(s.screenName + "_" + s.settingName, s);
    }
  }

  /**
   * バックグラウンド同期エンジン向けに、画面設定一覧全体を1つのSyncTargetとして
   * 返す(GAS側はJSON blobとしてしか保存しないため)。
   *
   * 画面設定はアセットidを内容に埋め込むことがあるが、AssetDataRepositoryの
   * SyncTargetはpush/pullのいずれでもアセット自身のidを変えない(常に同じ
   * driveDataIdの元でローカル/リモートを行き来する)ため、旧実装にあった
   * 「先にアセットを同期してidマッピングを作る」処理は不要になった。
   */
  async listSyncTargets(): Promise<SyncTarget<ScreenSetting[], ScreenSetting[]>[]> {
    const target: SyncTarget<ScreenSetting[], ScreenSetting[]> = {
      id: SYNC_KIND,
      kind: SYNC_KIND,
      getLocal: async () => {
        const settings = await this.getScreenSettings();
        if (settings.length === 0) return null;
        const trackedAt = await this.dirtyTracker.getUpdatedAt(SYNC_KIND);
        return { data: settings, updatedAt: trackedAt ?? Date.now() };
      },
      getRemote: async () => {
        const storedFileId = localStorage.getItem(DRIVE_FILE_ID_STORAGE_KEY) || undefined;
        if (!storedFileId) return null;
        let resp;
        try {
          resp = await this.jackpotApi.getJson(storedFileId);
        } catch (e) {
          console.error(
            "[ScreenConfigRepository] Failed to fetch remote screen configs for sync",
            e
          );
          return null;
        }
        let parsed: ScreenSetting[];
        try {
          parsed = JSON.parse(resp.json) as ScreenSetting[];
        } catch {
          return null;
        }
        if (!Array.isArray(parsed) || parsed.length === 0) return null;
        const updatedAt = resp.updatedAt ? new Date(resp.updatedAt).getTime() : 0;
        return { data: parsed, updatedAt };
      },
      push: async (settings) => {
        const driveJson: DriveJsonData = {
          metadata: {} as any,
          fileName: DRIVE_FILE_NAME,
          jsonText: JSON.stringify(settings),
          uploadDate: new Date().toISOString(),
          parentFolderId: "",
        };
        const meta = await this.jackpotApi.addJson(driveJson);
        if (meta?.fileId) {
          localStorage.setItem(DRIVE_FILE_ID_STORAGE_KEY, meta.fileId);
        }
        const updatedAt = meta?.lastUpdate
          ? new Date(meta.lastUpdate).getTime()
          : Date.now();
        await this.dirtyTracker.touch(SYNC_KIND, updatedAt);
        return { updatedAt };
      },
      pull: async (settings) => {
        await this.replaceAllScreenSettings(settings);
        const updatedAt = Date.now();
        await this.dirtyTracker.touch(SYNC_KIND, updatedAt);
        return { updatedAt };
      },
    };
    return [target];
  }
}
