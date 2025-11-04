import { KeyboardShortcut } from "./keyboard-shortcut";
import { KeyboardShortcutConfig } from "./keyboard-shortcut-config";

export interface IKeyboardShortcutRepository {
  getKeyboardShortcutsRaw(): Promise<string[][]>;
  saveKeyboardShortcuts(shortcuts: KeyboardShortcut[]): Promise<void>;
  getConfig(): Promise<KeyboardShortcutConfig>;
  saveConfig(config: KeyboardShortcutConfig): Promise<void>;
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
}
