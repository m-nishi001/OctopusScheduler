import { beforeEach, describe, expect, it, vi } from "vitest";
import { KeyboardShortcutService } from "./keyboard-shortcut-service";
import { PlayAudioEvent } from "../app-event/play-audio/play-audio-event";
import { KeyboardShortcutRepository } from "@model/keyboard-shortcut/keyboard-shortcut-repository";
import { KeyboardShortcut } from "@model/keyboard-shortcut/keyboard-shortcut";
import type { AppEventService } from "../app-event/app-event-service";

// We don't need to exercise GAS service; mock repository
class InMemoryRepository extends KeyboardShortcutRepository {
  private storage: any = {};
  constructor() {
    super({} as any);
  }
  async getKeyboardShortcutsRaw() {
    return this.storage.shortcuts || [];
  }
  async saveKeyboardShortcuts(shortcuts: any[]) {
    this.storage.shortcuts = shortcuts.map((s) =>
      s.serialize ? s.serialize() : s
    );
  }
  async getConfig() {
    const { KeyboardShortcutConfig } = await import(
      "@model/keyboard-shortcut/keyboard-shortcut-config"
    );
    return KeyboardShortcutConfig.createEmpty();
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
    // These tests only exercise shortcut matching, which never reaches the
    // legacy-actions migration path, so a stub AppEventService (never called)
    // is sufficient and avoids pulling in the DI container.
    const appEventService = {} as AppEventService;
    service = new KeyboardShortcutService(
      new InMemoryRepository(),
      appEventService
    );
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
      eventIds: [event.id],
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
      eventIds: [eventA.id],
    });
    const longCut = new KeyboardShortcut({
      id: "s2",
      keys: ["Control", "s", "1"],
      eventIds: [eventB.id],
    });
    await service.saveKeyboardShortcuts([shortCut, longCut]);

    const hasLonger = await service.hasLongerShortcutWithPrefix([
      "Control",
      "s",
    ]);
    expect(hasLonger).toBe(true);
  });
});

describe("KeyboardShortcutService legacy `actions` migration", () => {
  // This path parses untrusted data carried over from older GAS-stored
  // shortcuts, so unlike the compiler-checked switches in AppEventService,
  // its safety is guaranteed by these unit tests rather than by tsc.
  it("migrates a known-type legacy action into eventIds via AppEventService", async () => {
    const updateScheduleEvents = vi.fn(async () => {});
    const appEventService = {
      updateScheduleEvents,
    } as unknown as AppEventService;
    const repo = new InMemoryRepository();
    const service = new KeyboardShortcutService(repo, appEventService);

    await repo.saveKeyboardShortcuts([
      {
        id: "legacy-1",
        keys: ["Control", "9"],
        actions: [{ type: "PlayAudioEvent", audioId: "a1", fadeOutDuration: 0 }],
      } as any,
    ]);

    const shortcuts = await service.getKeyboardShortcuts();

    expect(updateScheduleEvents).toHaveBeenCalledOnce();
    expect(shortcuts).toHaveLength(1);
    expect(shortcuts[0].eventIds).toHaveLength(1);
  });

  it("skips an unknown-type legacy action with a warning instead of persisting it", async () => {
    const updateScheduleEvents = vi.fn(async () => {});
    const appEventService = {
      updateScheduleEvents,
    } as unknown as AppEventService;
    const repo = new InMemoryRepository();
    const service = new KeyboardShortcutService(repo, appEventService);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await repo.saveKeyboardShortcuts([
      {
        id: "legacy-2",
        keys: ["Control", "8"],
        actions: [{ type: "SomeRemovedEventType", foo: "bar" }],
      } as any,
    ]);

    const shortcuts = await service.getKeyboardShortcuts();

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(updateScheduleEvents).not.toHaveBeenCalled();
    expect(shortcuts).toHaveLength(1);
    expect(shortcuts[0].eventIds).toHaveLength(0);

    warnSpy.mockRestore();
  });
});
