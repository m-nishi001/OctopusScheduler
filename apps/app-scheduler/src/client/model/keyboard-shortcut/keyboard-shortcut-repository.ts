import { injectable, inject } from "tsyringe";
import { KeyboardShortcut } from "./keyboard-shortcut";
import type { KeyboardShortcutData } from "./keyboard-shortcut";
import { KeyboardShortcutConfig } from "./keyboard-shortcut-config";
import type { KeyboardShortcutConfigData } from "./keyboard-shortcut-config";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { DirtyTracker } from "@octopus/sync-engine";
import type { SyncTarget } from "@octopus/sync-engine";
import { IOctopusSchedulerApiToken } from "../../../server/scheduler-api-contract";
import type {
  KeyboardShortcutWireItem,
  OctopusSchedulerApi,
} from "../../../server/scheduler-api-contract";

const SYNC_KIND = "keyboard-shortcuts";

interface KeyboardShortcutsLocalSnapshot {
  shortcuts: KeyboardShortcutData[];
  config: KeyboardShortcutConfigData;
}

interface KeyboardShortcutsRemoteSnapshot {
  shortcuts: KeyboardShortcutWireItem[];
  config: unknown;
}

@injectable()
export class KeyboardShortcutRepository {
  private readonly localStorage: LocalStorageService;
  private readonly dirtyTracker: DirtyTracker;

  constructor(
    @inject(IOctopusSchedulerApiToken)
    private readonly schedulerApi: OctopusSchedulerApi
  ) {
    this.localStorage = new LocalStorageService(
      "octopus-scheduler",
      "KeyboardShortcut"
    );
    this.dirtyTracker = new DirtyTracker("octopus-scheduler");
  }

  async getKeyboardShortcutsRaw(): Promise<KeyboardShortcutData[]> {
    const data =
      await this.localStorage.get<KeyboardShortcutData[]>("shortcuts");
    return data || [];
  }

  async saveKeyboardShortcuts(shortcuts: KeyboardShortcut[]): Promise<void> {
    const datas = shortcuts.map((s) => s.serialize());
    // Ensure we pass plain JSON-serializable objects to LocalStorageService
    // This strips classes, methods and prototypes that may cause structured clone errors.
    const serializableDatas = JSON.parse(JSON.stringify(datas));
    await this.localStorage.save("shortcuts", serializableDatas as any);
    await this.dirtyTracker.touch(SYNC_KIND);
    eventBus.emit("syncDirty");
  }

  async getConfig(): Promise<KeyboardShortcutConfig> {
    const data =
      await this.localStorage.get<KeyboardShortcutConfigData>("config");
    if (data) {
      return KeyboardShortcutConfig.fromData(data);
    }
    return KeyboardShortcutConfig.createEmpty();
  }

  async saveConfig(config: KeyboardShortcutConfig): Promise<void> {
    const data = config.serialize();
    await this.localStorage.save("config", data);
    await this.dirtyTracker.touch(SYNC_KIND);
    eventBus.emit("syncDirty");
  }

  /**
   * バックグラウンド同期エンジン向けに、ショートカット+設定をまとめて1つの
   * SyncTargetとして返す。GAS側はこれらを不透明なJSONとしてしか保存しない
   * ため、個々のショートカット単位ではなくドメイン全体を1つの対象として扱う。
   *
   * ローカル側は個々のレコードに更新日時を持たないため、DirtyTracker が
   * 記録する最終変更日時を使う。まだ一度もtouchされていない場合(この機能を
   * 導入する前からのローカルデータ)は、既存の未同期の編集を誤ってリモートで
   * 上書きしないよう「今」を採用してローカル優先にする。
   */
  async listSyncTargets(): Promise<
    SyncTarget<KeyboardShortcutsLocalSnapshot, KeyboardShortcutsRemoteSnapshot>[]
  > {
    const target: SyncTarget<
      KeyboardShortcutsLocalSnapshot,
      KeyboardShortcutsRemoteSnapshot
    > = {
      id: SYNC_KIND,
      kind: SYNC_KIND,
      getLocal: async () => {
        const shortcuts = await this.getKeyboardShortcutsRaw();
        if (shortcuts.length === 0) return null;
        const config = await this.getConfig();
        const trackedAt = await this.dirtyTracker.getUpdatedAt(SYNC_KIND);
        const updatedAt = trackedAt ?? Date.now();
        return { data: { shortcuts, config: config.serialize() }, updatedAt };
      },
      getRemote: async () => {
        let remote;
        try {
          remote = await this.schedulerApi.getKeyboardShortcuts(undefined, {
            timeout: 30000,
          });
        } catch (e) {
          console.error(
            "[KeyboardShortcutRepository] Failed to fetch remote keyboard shortcuts for sync",
            e
          );
          return null;
        }
        if (!remote || (remote.shortcuts?.length ?? 0) === 0) return null;
        const updatedAt = remote.updatedAt
          ? new Date(remote.updatedAt).getTime()
          : 0;
        return {
          data: { shortcuts: remote.shortcuts, config: remote.config },
          updatedAt,
        };
      },
      push: async (local) => {
        const updatedAtIso = new Date().toISOString();
        const wireShortcuts: KeyboardShortcutWireItem[] = local.shortcuts.map(
          (data) => ({
            id: data.id,
            keys: data.keys,
            eventIds: data.eventIds ?? [],
          })
        );
        await this.schedulerApi.setKeyboardShortcuts(
          {
            shortcuts: wireShortcuts,
            config: local.config,
            updatedAt: updatedAtIso,
          },
          { timeout: 30000 }
        );
        const updatedAt = new Date(updatedAtIso).getTime();
        await this.dirtyTracker.touch(SYNC_KIND, updatedAt);
        return { updatedAt };
      },
      pull: async (remote) => {
        await this.localStorage.save("shortcuts", remote.shortcuts as any);
        await this.localStorage.save("config", remote.config as any);
        const updatedAt = Date.now();
        await this.dirtyTracker.touch(SYNC_KIND, updatedAt);
        return { updatedAt };
      },
    };
    return [target];
  }
}
