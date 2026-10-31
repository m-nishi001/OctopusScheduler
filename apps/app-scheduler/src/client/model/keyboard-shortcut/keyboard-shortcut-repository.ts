import { injectable, inject } from "tsyringe";
import { KeyboardShortcut } from "./keyboard-shortcut";
import type { KeyboardShortcutData } from "./keyboard-shortcut";
import { KeyboardShortcutConfig } from "./keyboard-shortcut-config";
import type { KeyboardShortcutConfigData } from "./keyboard-shortcut-config";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { BlobRecordStore, blobRecordSyncTarget } from "@octopus/sync-engine";
import type { SyncTarget } from "@octopus/sync-engine";
import { IOctopusSchedulerApiToken } from "../../../server/scheduler-api-contract";
import type { OctopusSchedulerApi } from "../../../server/scheduler-api-contract";

const SYNC_KIND = "keyboard-shortcuts";

/** ショートカットと設定をまとめた、同期の1件分のデータ。 */
interface KeyboardShortcutsRecord {
  shortcuts: KeyboardShortcutData[];
  config: KeyboardShortcutConfigData;
}

/** キーボードショートカットとその設定の保存先。この端末に1件のレコード `{ data, updatedAt }` で持ち、変更があればバックグラウンド同期でサーバーと新しいほうに揃える。 */
@injectable()
export class KeyboardShortcutRepository {
  private readonly store = new BlobRecordStore<KeyboardShortcutsRecord>("octopus-scheduler", "KeyboardShortcut");

  constructor(
    @inject(IOctopusSchedulerApiToken)
    private readonly schedulerApi: OctopusSchedulerApi
  ) {}

  async getKeyboardShortcutsRaw(): Promise<KeyboardShortcutData[]> {
    return (await this.store.read())?.data.shortcuts ?? [];
  }

  async saveKeyboardShortcuts(shortcuts: KeyboardShortcut[]): Promise<void> {
    const datas = shortcuts.map((s) => s.serialize());
    // Ensure we pass plain JSON-serializable objects to LocalStorageService
    // This strips classes, methods and prototypes that may cause structured clone errors.
    const serializableDatas: KeyboardShortcutData[] = JSON.parse(JSON.stringify(datas));
    await this.store.update((current) => ({
      shortcuts: serializableDatas,
      config: current?.config ?? KeyboardShortcutConfig.createEmpty().serialize(),
    }));
    eventBus.emit("syncDirty");
  }

  async getConfig(): Promise<KeyboardShortcutConfig> {
    const data = (await this.store.read())?.data.config;
    if (data) {
      return KeyboardShortcutConfig.fromData(data);
    }
    return KeyboardShortcutConfig.createEmpty();
  }

  async saveConfig(config: KeyboardShortcutConfig): Promise<void> {
    const data = config.serialize();
    await this.store.update((current) => ({ shortcuts: current?.shortcuts ?? [], config: data }));
    eventBus.emit("syncDirty");
  }

  /**
   * バックグラウンド同期エンジン向けに、ショートカット+設定をまとめて1つの
   * SyncTargetとして返す。GAS側はこれらを不透明なJSONとしてしか保存しない
   * ため、個々のショートカット単位ではなくドメイン全体を1つの対象として扱う。
   * 最後の1件を消して空にした状態も、「レコードが無い」とは区別されて同期される。
   */
  async listSyncTargets(): Promise<SyncTarget<KeyboardShortcutsRecord, KeyboardShortcutsRecord>[]> {
    return [
      blobRecordSyncTarget(SYNC_KIND, this.store, {
        get: async () => {
          const remote = await this.schedulerApi.getKeyboardShortcuts(undefined, { timeout: 30000 });
          // 一度も保存されていない(更新日時が無い)なら「データなし」。更新日時があるなら、空でもそれが最新の状態
          if (!remote?.updatedAt) return null;
          return {
            data: { shortcuts: remote.shortcuts, config: remote.config as KeyboardShortcutConfigData },
            updatedAt: new Date(remote.updatedAt).getTime(),
          };
        },
        put: async ({ data, updatedAt }) => {
          await this.schedulerApi.setKeyboardShortcuts(
            {
              shortcuts: data.shortcuts.map((s) => ({ id: s.id, keys: s.keys, eventIds: s.eventIds ?? [] })),
              config: data.config,
              updatedAt: new Date(updatedAt).toISOString(),
            },
            { timeout: 30000 }
          );
        },
      }),
    ];
  }
}
