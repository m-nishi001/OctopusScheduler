import { injectable, inject } from "tsyringe";
import { KeyboardShortcut } from "@model/keyboard-shortcut/keyboard-shortcut";
import { KeyboardShortcutConfig } from "@model/keyboard-shortcut/keyboard-shortcut-config";
import { KeyboardShortcutRepository } from "@model/keyboard-shortcut/keyboard-shortcut-repository";
import type { AppEventData } from "@model/app-event/app-event-data";
import { AppEventService } from "../app-event/app-event-service";
import type { AppEvent } from "../app-event/app-event";

// レガシー形式の `actions`(旧shortcutに埋め込まれたイベントデータ)を移行する際、
// 未知の種別が混在していても assertNever まで到達させず、ここで安全に弾く。
// GAS/ローカルストレージ由来の未検証データを解釈する境界のため、コンパイラでは
// 網羅性を保証できず、単体テストで既知5種別+未知種別のフォールバックを担保する。
function isKnownAppEventType(type: unknown): type is AppEventData["type"] {
  return (
    type === "PlayAudioEvent" ||
    type === "ShowContentEvent" ||
    type === "SlideshowEvent" ||
    type === "StopAudioEvent" ||
    type === "TransitionPageEvent"
  );
}

@injectable()
export class KeyboardShortcutService {
  constructor(
    @inject(KeyboardShortcutRepository) private repository: KeyboardShortcutRepository,
    @inject(AppEventService) private appEventService: AppEventService
  ) {}

  async getKeyboardShortcuts(): Promise<KeyboardShortcut[]> {
    const datas = await this.repository.getKeyboardShortcutsRaw();
    // Migrate legacy `actions` (embedded action objects) into persisted
    // schedule events and populate `eventIds`. This ensures shortcuts
    // fetched from older GAS exports still work with the new model.
    for (const data of datas) {
      if ((data as any).eventIds && (data as any).eventIds.length > 0)
        continue;
      const legacyActions = (data as any).actions || [];
      if (!legacyActions || legacyActions.length === 0) continue;
      // Assign ids for each legacy action if missing, skipping any whose
      // type is not one of the known AppEventData kinds so an unrecognized
      // legacy entry can't later crash reviveEvent()'s assertNever branch.
      const toSave: AppEventData[] = [];
      for (const a of legacyActions) {
        if (!isKnownAppEventType(a?.type)) {
          console.warn(
            `[KeyboardShortcutService] skipping legacy shortcut action with unknown type: ${a?.type}`
          );
          continue;
        }
        toSave.push({ ...a, id: a.id || crypto.randomUUID() });
      }
      if (toSave.length === 0) continue;
      try {
        // AppEvent instances are a superset of AppEventData; updateScheduleEvents
        // only persists the plain fields, so passing revived-less data here is safe.
        await this.appEventService.updateScheduleEvents(
          toSave as unknown as AppEvent[]
        );
        // populate eventIds so subsequent code can resolve them
        (data as any).eventIds = toSave.map((t) => t.id);
      } catch (e) {
        console.error("Failed migrating legacy shortcut actions to events", e);
      }
    }

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
    if (removed && removed.eventIds.length > 0) {
      try {
        await this.appEventService.deleteScheduleEvents(removed.eventIds);
      } catch (e) {
        console.error(
          "[KeyboardShortcutService] failed to remove shortcut-related events",
          e
        );
      }
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

  // ショートカットが参照するイベントを順に実行する(旧 KeyboardShortcut.execute() から移動)
  async executeShortcut(shortcut: KeyboardShortcut): Promise<void> {
    for (const id of shortcut.eventIds) {
      try {
        const ev = await this.appEventService.getEventById(id);
        if (!ev) continue;
        ev.execute(true, true).catch((err) => {
          console.error(
            `[KeyboardShortcutService] execute promise rejected eventId=${id} err=`,
            err
          );
        });
      } catch (err) {
        console.error(
          `[KeyboardShortcutService] failed to execute eventId=${id} err=`,
          err
        );
        // ignore individual event execution errors
      }
    }
  }
}
