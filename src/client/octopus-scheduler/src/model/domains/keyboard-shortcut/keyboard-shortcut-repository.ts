import { KeyboardShortcut } from "./keyboard-shortcut";
import type { KeyboardShortcutData } from "./keyboard-shortcut";
import { KeyboardShortcutConfig } from "./keyboard-shortcut-config";
import type { KeyboardShortcutConfigData } from "./keyboard-shortcut-config";
import { GasFunctionService } from "@common-lib/google-apps-script/gas-script-service";
import { LocalStorageService } from "@common-lib/storage/local-storage-service";

export interface IKeyboardShortcutRepository {
  getKeyboardShortcutsRaw(): Promise<KeyboardShortcutData[]>;
  saveKeyboardShortcuts(shortcuts: KeyboardShortcut[]): Promise<void>;
  getConfig(): Promise<KeyboardShortcutConfig>;
  saveConfig(config: KeyboardShortcutConfig): Promise<void>;
  syncWithServer(direction: "gas-to-local" | "local-to-gas"): Promise<void>;
}

export const IKeyboardShortcutRepositoryToken = Symbol(
  "IKeyboardShortcutRepository"
);

export class KeyboardShortcutRepository implements IKeyboardShortcutRepository {
  private readonly localStorage: LocalStorageService;

  constructor() {
    this.localStorage = new LocalStorageService(
      "octopus-scheduler",
      "KeyboardShortcut"
    );
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
    try {
      console.debug(
        `[KeyboardShortcutRepository.saveKeyboardShortcuts] saving ${datas.length} shortcuts`,
        {
          sample: datas[0],
        }
      );
    } catch (e) {
      // ignore logging errors
    }
    await this.localStorage.save("shortcuts", serializableDatas as any);
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
  }

  async syncWithServer(
    direction: "gas-to-local" | "local-to-gas"
  ): Promise<void> {
    if (direction === "gas-to-local") {
      // GASからデータを取得し、ローカルを完全上書き
      const getService = new GasFunctionService("getKeyboardShortcuts", {
        timeout: 30000,
      });
      try {
        const remoteData = await getService.call<{
          shortcuts: string[][];
          config: any;
        }>();
        if (remoteData) {
          const datas = this.convertLegacyShortcuts(remoteData.shortcuts);
          const serializableDatas = JSON.parse(JSON.stringify(datas));
          await this.localStorage.save("shortcuts", serializableDatas as any);
          await this.localStorage.save("config", remoteData.config);
        }
      } catch (error) {
        throw new Error(`GASからの同期に失敗: ${(error as Error).message}`);
      }
    } else if (direction === "local-to-gas") {
      // ローカルデータを取得し、GASに送信して上書き
      const shortcuts = await this.getKeyboardShortcutsRaw();
      const config = await this.getConfig();
      const setService = new GasFunctionService("setKeyboardShortcuts", {
        timeout: 30000,
      });
      try {
        // GAS 側は古い形式を期待しているので、string[][] に変換
        const legacyShortcuts = shortcuts.map((data) => [
          data.id,
          JSON.stringify(data.keys),
          data.action.type,
          ...this.serializeActionToLegacy(data.action),
        ]);
        await setService.call({
          shortcuts: legacyShortcuts,
          config: config.serialize(),
        });
      } catch (error) {
        throw new Error(`GASへの同期に失敗: ${(error as Error).message}`);
      }
    }
  }

  private convertLegacyShortcuts(raws: string[][]): KeyboardShortcutData[] {
    return raws.map((raw) => {
      const [id, keysStr, type, ...actionRaw] = raw;
      const keys = JSON.parse(keysStr);
      const action: any = { type };
      // actionRaw の順序に基づいてプロパティを設定
      switch (type) {
        case "TransitionPageEvent":
          action.transitionUrl = actionRaw[2];
          action.fadeOutDuration = actionRaw[3]
            ? Number(actionRaw[3])
            : undefined;
          action.processedAt = actionRaw[4]
            ? new Date(actionRaw[4]).toISOString()
            : null;
          action.registeredAt = actionRaw[5]
            ? new Date(actionRaw[5]).toISOString()
            : new Date().toISOString();
          action.updatedAt = actionRaw[6]
            ? new Date(actionRaw[6]).toISOString()
            : new Date().toISOString();
          break;
        case "PlayAudioEvent":
          action.audioId = actionRaw[2];
          action.fadeOutDuration = actionRaw[3]
            ? Number(actionRaw[3])
            : undefined;
          action.processedAt = actionRaw[4]
            ? new Date(actionRaw[4]).toISOString()
            : null;
          action.registeredAt = actionRaw[5]
            ? new Date(actionRaw[5]).toISOString()
            : new Date().toISOString();
          action.updatedAt = actionRaw[6]
            ? new Date(actionRaw[6]).toISOString()
            : new Date().toISOString();
          break;
        case "SlideshowEvent":
          action.folderId = actionRaw[2];
          action.displayDuration = Number(actionRaw[3]);
          action.transitionType = actionRaw[4];
          action.slideDirection = actionRaw[5] || undefined;
          action.bgmIds = actionRaw[6] ? actionRaw[6].split(",") : [];
          action.processedAt = actionRaw[7]
            ? new Date(actionRaw[7]).toISOString()
            : null;
          action.registeredAt = actionRaw[8]
            ? new Date(actionRaw[8]).toISOString()
            : new Date().toISOString();
          action.updatedAt = actionRaw[9]
            ? new Date(actionRaw[9]).toISOString()
            : new Date().toISOString();
          break;
        case "ShowContentEvent":
          action.contentType = actionRaw[2];
          action.contentId = actionRaw[3] || undefined;
          action.htmlString = actionRaw[4] || undefined;
          action.fadeOutDuration = actionRaw[5]
            ? Number(actionRaw[5])
            : undefined;
          action.displayMode = actionRaw[6] || undefined;
          action.effect = actionRaw[7] || undefined;
          action.duration = actionRaw[8] ? Number(actionRaw[8]) : undefined;
          action.fadeInTime = actionRaw[9] ? Number(actionRaw[9]) : undefined;
          action.fadeOutTime = actionRaw[10]
            ? Number(actionRaw[10])
            : undefined;
          action.scrollDirection = actionRaw[11] || undefined;
          action.processedAt = actionRaw[12]
            ? new Date(actionRaw[12]).toISOString()
            : null;
          action.registeredAt = actionRaw[13]
            ? new Date(actionRaw[13]).toISOString()
            : new Date().toISOString();
          action.updatedAt = actionRaw[14]
            ? new Date(actionRaw[14]).toISOString()
            : new Date().toISOString();
          break;
      }
      return { id, keys, action };
    });
  }

  private serializeActionToLegacy(action: any): string[] {
    return action.serialize();
  }
}
