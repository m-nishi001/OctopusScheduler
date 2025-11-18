import { injectable, inject, container } from "tsyringe";
import { KeyboardShortcut } from "../../domains/keyboard-shortcut/keyboard-shortcut";
import { KeyboardShortcutConfig } from "../../domains/keyboard-shortcut/keyboard-shortcut-config";
import type { IKeyboardShortcutRepository } from "../../domains/keyboard-shortcut/keyboard-shortcut-repository";
import { IKeyboardShortcutRepositoryToken } from "../../domains/keyboard-shortcut/keyboard-shortcut-repository";
import type { IScheduleEventConverter } from "../../domains/schedule-event/i-schedule-event-converter";
import { IScheduleEventConverterToken } from "../../domains/schedule-event/i-schedule-event-converter";

@injectable()
export class KeyboardShortcutService {
  private readonly converters: IScheduleEventConverter[];

  constructor(
    @inject(IKeyboardShortcutRepositoryToken)
    private repository: IKeyboardShortcutRepository
  ) {
    this.converters = container.resolveAll(IScheduleEventConverterToken);
  }

  async getKeyboardShortcuts(): Promise<KeyboardShortcut[]> {
    const datas = await this.repository.getKeyboardShortcutsRaw();
    return datas.map((data) => KeyboardShortcut.fromData(data));
  }

  async saveKeyboardShortcuts(shortcuts: KeyboardShortcut[]): Promise<void> {
    await this.repository.saveKeyboardShortcuts(shortcuts);
  }

  async addKeyboardShortcut(shortcut: KeyboardShortcut): Promise<void> {
    const shortcuts = await this.getKeyboardShortcuts();
    shortcuts.push(shortcut);
    await this.saveKeyboardShortcuts(shortcuts);
  }

  async deleteKeyboardShortcut(id: string): Promise<void> {
    const shortcuts = await this.getKeyboardShortcuts();
    const filtered = shortcuts.filter((s) => s.id !== id);
    await this.saveKeyboardShortcuts(filtered);
  }

  async getConfig(): Promise<KeyboardShortcutConfig> {
    return await this.repository.getConfig();
  }

  async saveConfig(config: KeyboardShortcutConfig): Promise<void> {
    await this.repository.saveConfig(config);
  }

  async isEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config.enabled;
  }

  async syncWithServer(
    direction: "gas-to-local" | "local-to-gas"
  ): Promise<void> {
    await this.repository.syncWithServer(direction);
    if (direction === "gas-to-local") {
      // GASから取得したデータを新しい形式に変換して保存
      await this.loadShortcuts();
    }
  }

  async loadShortcuts(): Promise<void> {
    // GASから取得したデータをリロードして保存
    const shortcuts = await this.getKeyboardShortcuts();
    await this.saveKeyboardShortcuts(shortcuts);
  }

  async findShortcutByKeys(keys: string[]): Promise<KeyboardShortcut | null> {
    const shortcuts = await this.getKeyboardShortcuts();
    return shortcuts.find((s) => this.keysMatch(s.keys, keys)) || null;
  }

  async hasLongerShortcutWithPrefix(keys: string[]): Promise<boolean> {
    const shortcuts = await this.getKeyboardShortcuts();
    return shortcuts.some(
      (s) =>
        s.keys.length > keys.length &&
        s.keys.slice(0, keys.length).every((k, i) => k === keys[i])
    );
  }

  private keysMatch(shortcutKeys: string[], inputKeys: string[]): boolean {
    if (shortcutKeys.length !== inputKeys.length) return false;
    return shortcutKeys.every((key, index) => key === inputKeys[index]);
  }

  // revive 実装 (古い形式の string[][] から復元)
  reviveShortcut(raw: string[]): KeyboardShortcut | null {
    if (raw.length < 3) return null;
    const [id, keysStr, type, ...actionRaw] = raw;
    const keys = JSON.parse(keysStr);
    const actionRawObj = { id, type, ...actionRaw };
    // コンバーターでactionをrevive
    const converter = this.converters.find((c) => c.getType() === type);
    if (!converter) return null;
    const action = converter.revive(actionRawObj as any);
    return new KeyboardShortcut({ id, keys, action });
  }
}
