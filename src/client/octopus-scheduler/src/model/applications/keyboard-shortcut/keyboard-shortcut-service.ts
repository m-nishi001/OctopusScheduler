import { injectable, inject, container } from "tsyringe";
import { KeyboardShortcut } from "../../domains/keyboard-shortcut/keyboard-shortcut";
import { KeyboardShortcutConfig } from "../../domains/keyboard-shortcut/keyboard-shortcut-config";
import type { IKeyboardShortcutRepository } from "../../domains/keyboard-shortcut/keyboard-shortcut-repository";
import { IKeyboardShortcutRepositoryToken } from "../../domains/keyboard-shortcut/keyboard-shortcut-repository";
// event serializer tokens removed (not used by this service anymore)
import { AppEventService } from "../app-event/app-event-service";

@injectable()
export class KeyboardShortcutService {
  constructor(
    @inject(IKeyboardShortcutRepositoryToken)
    private repository: IKeyboardShortcutRepository
  ) {}

  async getKeyboardShortcuts(): Promise<KeyboardShortcut[]> {
    const datas = await this.repository.getKeyboardShortcutsRaw();
    // Migrate legacy `actions` (embedded action objects) into persisted
    // schedule events and populate `eventIds`. This ensures shortcuts
    // fetched from older GAS exports still work with the new model.
    try {
      const appEventService = container.resolve(AppEventService);
      for (const data of datas) {
        if ((data as any).eventIds && (data as any).eventIds.length > 0)
          continue;
        const legacyActions = (data as any).actions || [];
        if (!legacyActions || legacyActions.length === 0) continue;
        // Assign ids for each legacy action if missing
        const toSave: any[] = legacyActions.map((a: any) => ({
          ...a,
          id: a.id || crypto.randomUUID(),
        }));
        try {
          await appEventService.updateScheduleEvents(toSave as any);
          // populate eventIds so subsequent code can resolve them
          (data as any).eventIds = toSave.map((t) => t.id);
        } catch (e) {
          console.error(
            "Failed migrating legacy shortcut actions to events",
            e
          );
        }
      }
    } catch (e) {
      // If AppEventService not available, skip migration silently
    }

    return datas.map((data) => KeyboardShortcut.fromData(data));
  }

  async saveKeyboardShortcuts(shortcuts: KeyboardShortcut[]): Promise<void> {
    await this.repository.saveKeyboardShortcuts(shortcuts);
  }

  async addKeyboardShortcut(shortcut: KeyboardShortcut): Promise<void> {
    const shortcuts = await this.getKeyboardShortcuts();
    shortcuts.push(shortcut);
    try {
      console.debug(
        "[KeyboardShortcutService.addKeyboardShortcut] adding shortcut",
        {
          id: shortcut.id,
          keys: shortcut.keys,
          eventIds: (shortcut as any).eventIds || [],
        }
      );
    } catch (e) {
      /* ignore */
    }
    await this.saveKeyboardShortcuts(shortcuts);
  }

  async updateKeyboardShortcut(shortcut: KeyboardShortcut): Promise<void> {
    const shortcuts = await this.getKeyboardShortcuts();
    const idx = shortcuts.findIndex((s) => s.id === shortcut.id);
    if (idx >= 0) {
      shortcuts[idx] = shortcut;
    } else {
      shortcuts.push(shortcut);
    }
    await this.saveKeyboardShortcuts(shortcuts);
  }

  async deleteKeyboardShortcut(id: string): Promise<void> {
    const shortcuts = await this.getKeyboardShortcuts();
    const removed = shortcuts.find((s) => s.id === id);
    const filtered = shortcuts.filter((s) => s.id !== id);
    await this.saveKeyboardShortcuts(filtered);

    // remove associated events if eventIds available
    try {
      if (
        removed &&
        (removed as any).eventIds &&
        (removed as any).eventIds.length > 0
      ) {
        const appEventService = container.resolve(AppEventService);
        const ids = (removed as any).eventIds.filter(Boolean);
        if (ids.length > 0)
          await appEventService.deleteScheduleEvents(ids as any);
      }
    } catch (e) {
      console.error(
        "[KeyboardShortcutService] failed to remove shortcut-related events",
        e
      );
    }
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
    const [id, keysStr] = raw;
    const keys = JSON.parse(keysStr);
    // Legacy revive: return a shortcut with no eventIds; migration should convert legacy actions to events.
    return new KeyboardShortcut({ id, keys, eventIds: [] });
  }
}
