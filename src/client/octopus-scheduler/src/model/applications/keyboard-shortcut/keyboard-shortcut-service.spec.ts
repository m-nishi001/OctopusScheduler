import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeyboardShortcutService } from "./keyboard-shortcut-service";
import { PlayAudioEvent } from "../../domains/app-event/play-audio/play-audio-event";
import { KeyboardShortcutRepository } from "../../domains/keyboard-shortcut/keyboard-shortcut-repository";
import { KeyboardShortcut } from "../../domains/keyboard-shortcut/keyboard-shortcut";
import { IAppEventConverterToken } from "../../domains/app-event/i-app-event-converter";
import { container } from "tsyringe";
import { IKeyboardShortcutRepositoryToken } from "../../domains/keyboard-shortcut/keyboard-shortcut-repository";

// We don't need to exercise GAS service; mock repository
class InMemoryRepository extends KeyboardShortcutRepository {
  private storage: any = {};
  async getKeyboardShortcutsRaw() {
    return this.storage.shortcuts || [];
  }
  async saveKeyboardShortcuts(shortcuts: any[]) {
    this.storage.shortcuts = shortcuts.map((s) =>
      s.serialize ? s.serialize() : s
    );
  }
  async getConfig() {
    return { enabled: true };
  }
  async saveConfig() {
    return;
  }
  async syncWithServer() {
    return;
  }
}

describe("KeyboardShortcutService", () => {
  let service: KeyboardShortcutService;
  beforeEach(() => {
    // Use the real repo class but with override
    container.clearInstances();
    container.register(IKeyboardShortcutRepositoryToken, {
      useClass: InMemoryRepository,
    });
    // register a dummy schedule event converter to avoid DI error
    container.register(IAppEventConverterToken, {
      useValue: {
        getType: () => "Dummy",
        revive: (data: any) => ({
          id: data.id,
          type: data.type,
          serialize: () => [],
        }),
      },
    });
    service = container.resolve(KeyboardShortcutService);
  });

  it("matches 3-key sequence", async () => {
    // Construct a real KeyboardShortcut object
    const now = new Date();
    const event = PlayAudioEvent.fromParams({
      id: "e1",
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      audioId: "a1",
      fadeOutDuration: 0,
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
    const shortcut = new KeyboardShortcut({
      id: "s1",
      keys: ["Control", "s", "1"],
      action: event,
    });
    await service.saveKeyboardShortcuts([shortcut]);

    const found = await service.findShortcutByKeys(["Control", "s", "1"]);
    expect(found).not.toBeNull();
  });

  it("detects longer prefix", async () => {
    const now = new Date();
    const eventA = PlayAudioEvent.fromParams({
      id: "e1",
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      audioId: "a1",
      fadeOutDuration: 0,
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
    const eventB = PlayAudioEvent.fromParams({
      id: "e2",
      startTime: now,
      endTime: new Date(now.getTime() + 1000),
      audioId: "a2",
      fadeOutDuration: 0,
      processedAt: null,
      registeredAt: now,
      updatedAt: now,
    });
    const shortCut = new KeyboardShortcut({
      id: "s1",
      keys: ["Control", "s"],
      action: eventA,
    });
    const longCut = new KeyboardShortcut({
      id: "s2",
      keys: ["Control", "s", "1"],
      action: eventB,
    });
    await service.saveKeyboardShortcuts([shortCut, longCut]);

    const hasLonger = await service.hasLongerShortcutWithPrefix([
      "Control",
      "s",
    ]);
    expect(hasLonger).toBe(true);
  });
});
