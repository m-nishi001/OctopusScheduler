import { injectable, inject } from "tsyringe";
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
    private repository: IKeyboardShortcutRepository,
    @inject(IScheduleEventConverterToken)
    converters: IScheduleEventConverter[]
  ) {
    this.converters = converters;
  }

  async getKeyboardShortcuts(): Promise<KeyboardShortcut[]> {
    const raws = await this.repository.getKeyboardShortcutsRaw();
    return raws
      .map((raw) => this.reviveShortcut(raw))
      .filter(Boolean) as KeyboardShortcut[];
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
    try {
      await this.repository.syncWithServer(direction);
    } catch (error) {
      throw new Error(`同期に失敗しました: ${(error as Error).message}`);
    }
  }

  async findShortcutByKeys(keys: string[]): Promise<KeyboardShortcut | null> {
    const shortcuts = await this.getKeyboardShortcuts();
    return shortcuts.find((s) => this.keysMatch(s.keys, keys)) || null;
  }

  private keysMatch(shortcutKeys: string[], inputKeys: string[]): boolean {
    if (shortcutKeys.length !== inputKeys.length) return false;
    return shortcutKeys.every((key, index) => key === inputKeys[index]);
  }

  // revive 実装
  reviveShortcut(raw: string[]): KeyboardShortcut | null {
    if (raw.length < 3) return null;
    const [id, keysStr, type, ...actionRaw] = raw;
    const keys = JSON.parse(keysStr);
    const actionRawObj = { type, ...actionRaw }; // 仮のオブジェクト
    // コンバーターでactionをrevive
    const converter = this.converters.find((c) => c.getType() === type);
    if (!converter) return null;
    const action = converter.revive(actionRawObj as any); // 型合わせ
    return new KeyboardShortcut({ id, keys, action });
  }
}
