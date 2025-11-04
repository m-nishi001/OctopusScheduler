import { KeyboardShortcut } from "./keyboard-shortcut";
import { KeyboardShortcutConfig } from "./keyboard-shortcut-config";
import { GasFunctionService } from "../../../../../packages/common-lib/src/google-apps-script/gas-script-service";

export interface IKeyboardShortcutRepository {
  getKeyboardShortcutsRaw(): Promise<string[][]>;
  saveKeyboardShortcuts(shortcuts: KeyboardShortcut[]): Promise<void>;
  getConfig(): Promise<KeyboardShortcutConfig>;
  saveConfig(config: KeyboardShortcutConfig): Promise<void>;
  syncWithServer(direction: "gas-to-local" | "local-to-gas"): Promise<void>;
}

export const IKeyboardShortcutRepositoryToken = Symbol(
  "IKeyboardShortcutRepository"
);

export class KeyboardShortcutRepository implements IKeyboardShortcutRepository {
  private readonly shortcutsKey = "keyboard-shortcuts";
  private readonly configKey = "keyboard-shortcuts-config";

  async getKeyboardShortcutsRaw(): Promise<string[][]> {
    const stored = localStorage.getItem(this.shortcutsKey);
    if (!stored) return [];
    return JSON.parse(stored);
  }

  async saveKeyboardShortcuts(shortcuts: KeyboardShortcut[]): Promise<void> {
    const raws = shortcuts.map((s) => s.serialize());
    localStorage.setItem(this.shortcutsKey, JSON.stringify(raws));
  }

  async getConfig(): Promise<KeyboardShortcutConfig> {
    const stored = localStorage.getItem(this.configKey);
    if (!stored) return KeyboardShortcutConfig.createEmpty();
    const raw = JSON.parse(stored);
    return KeyboardShortcutConfig.revive(raw);
  }

  async saveConfig(config: KeyboardShortcutConfig): Promise<void> {
    const raw = config.serialize();
    localStorage.setItem(this.configKey, JSON.stringify(raw));
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
          localStorage.setItem(
            this.shortcutsKey,
            JSON.stringify(remoteData.shortcuts)
          );
          localStorage.setItem(
            this.configKey,
            JSON.stringify(remoteData.config)
          );
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
        await setService.call({ shortcuts, config: config.serialize() });
      } catch (error) {
        throw new Error(`GASへの同期に失敗: ${(error as Error).message}`);
      }
    }
  }
}
