import { injectable, inject } from "tsyringe";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { BlobRecordStore, blobRecordSyncTarget, textBlobRecordRemote } from "@octopus/sync-engine";
import type { SyncTarget } from "@octopus/sync-engine";
import { ScreenSetting } from "./screen-setting";
import { IJackpotGameApiToken } from "../../../server/jackpot-api-contract";
import type { JackpotGameApi } from "../../../server/jackpot-api-contract";

const SYNC_KIND = "screens";
const DRIVE_FILE_NAME = "screens.json";

const settingKey = (s: ScreenSetting) => s.screenName + "_" + s.settingName;

/** 各画面の設定の保存先。この端末(IndexedDB)に一覧全体を1件のレコード `{ data, updatedAt }` で持ち、バックグラウンド同期の対象として Drive / R2 と新しいほうに揃える。 */
@injectable()
export class ScreenConfigRepository {
  private readonly store = new BlobRecordStore<ScreenSetting[]>("jackpot-game", "ScreenConfigData");

  constructor(
    @inject(IJackpotGameApiToken) private readonly jackpotApi: JackpotGameApi
  ) {}

  async getScreenSettings(): Promise<ScreenSetting[]> {
    return (await this.store.read())?.data ?? [];
  }

  async getScreenSettingsByType(type: string): Promise<ScreenSetting[]> {
    const allSettings = await this.getScreenSettings();
    return allSettings.filter((setting) => setting.screenName === type);
  }

  async updateScreenSettings(settings: ScreenSetting[]): Promise<void> {
    await this.store.update((current) => {
      const byKey = new Map((current ?? []).map((s) => [settingKey(s), s] as const));
      for (const setting of settings) byKey.set(settingKey(setting), setting);
      return Array.from(byKey.values());
    });
    eventBus.emit("syncDirty");
  }

  /**
   * バックグラウンド同期エンジン向けに、画面設定一覧全体を1つのSyncTargetとして
   * 返す(GAS側はJSON blobとしてしか保存しないため)。
   *
   * 画面設定はアセットidを内容に埋め込むことがあるが、AssetDataRepositoryの
   * SyncTargetはpush/pullのいずれでもアセット自身のidを変えない(常に同じ
   * driveDataIdの元でローカル/リモートを行き来する)ため、先にアセットを同期する必要はない。
   */
  async listSyncTargets(): Promise<SyncTarget<ScreenSetting[], ScreenSetting[]>[]> {
    return [
      blobRecordSyncTarget(
        SYNC_KIND,
        this.store,
        textBlobRecordRemote<ScreenSetting[]>({
          read: async () => (await this.jackpotApi.getJson(DRIVE_FILE_NAME)).json,
          write: (json) => this.jackpotApi.addJson({ fileName: DRIVE_FILE_NAME, json }),
        })
      ),
    ];
  }
}
