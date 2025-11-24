import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import "reflect-metadata";
import { KeyboardShortcutService } from "../keyboard-shortcut-service";
import { Container } from "../../../../core/container/index";
import { KeyboardShortcut } from "../../../domains/keyboard-shortcut/keyboard-shortcut";
import { PlayAudioEvent } from "../../../domains/app-event/play-audio/play-audio-event";
import { TransitionPageEvent } from "../../../domains/app-event/transition/transition-page-event";
import { KeyboardShortcutConfig } from "../../../domains/keyboard-shortcut/keyboard-shortcut-config";
import { eventBus } from "../../../../core/event-bus";

class MockRepository {
  private shortcutsData: any[] = [];
  private config: any = KeyboardShortcutConfig.createEmpty();

  async getKeyboardShortcutsRaw() {
    return this.shortcutsData;
  }
  async saveKeyboardShortcuts(shortcuts: any[]) {
    this.shortcutsData = shortcuts;
  }
  async getConfig() {
    return this.config;
  }
  async saveConfig(config: any) {
    this.config = config;
  }
  async syncWithServer(direction: "gas-to-local" | "local-to-gas") {
    // noop
  }
}

const mockRepo = new MockRepository() as any;

let service: KeyboardShortcutService;

beforeEach(() => {
  // reset repo and create service
  mockRepo.shortcutsData = [];
  mockRepo.config = KeyboardShortcutConfig.createEmpty();
  Container.Register();
  service = new KeyboardShortcutService(mockRepo);
});

afterEach(() => {
  // clear event listeners
  (eventBus as any).all.clear?.();
});

describe("KeyboardShortcutService", () => {
  it("finds a shortcut by keys, executes PlayAudioEvent and emits playAudio", async () => {
    // prepare PlayAudioEvent
    const playEvent = PlayAudioEvent.fromData({
      id: "e1",
      audioId: "audio-1",
      processedAt: null,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const shortcut = new KeyboardShortcut({
      id: "s1",
      keys: ["Control", "1"],
      actions: [playEvent],
    });

    await mockRepo.saveKeyboardShortcuts([shortcut.serialize()]);

    const spy = vi.fn();
    eventBus.on("playAudio", spy);

    const found = await service.findShortcutByKeys(["Control", "1"]);
    expect(found).not.toBeNull();

    await found!.execute();

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toEqual({ audioId: "audio-1", manual: true });
  });

  it("finds a shortcut for TransitionPageEvent and emits transitionPage", async () => {
    const event = TransitionPageEvent.fromData({
      id: "e2",
      transitionUrl: "/test/path",
      processedAt: null,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const shortcut = new KeyboardShortcut({
      id: "s2",
      keys: ["1"],
      actions: [event],
    });

    await mockRepo.saveKeyboardShortcuts([shortcut.serialize()]);

    const spy = vi.fn();
    eventBus.on("transitionPage", spy);

    const found = await service.findShortcutByKeys(["1"]);
    expect(found).not.toBeNull();

    await found!.execute();

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toEqual({
      transitionUrl: "/test/path",
      manual: true,
    });
  });

  it("isEnabled() reflects repository config", async () => {
    mockRepo.config = new KeyboardShortcutConfig(false);
    expect(await service.isEnabled()).toBe(false);
    mockRepo.config = new KeyboardShortcutConfig(true);
    expect(await service.isEnabled()).toBe(true);
  });

  it("keys matching is strict about order and length", async () => {
    const event = TransitionPageEvent.fromData({
      id: "e3",
      transitionUrl: "/p",
      processedAt: null,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const shortcut = new KeyboardShortcut({
      id: "s3",
      keys: ["Control", "Shift", "1"],
      actions: [event],
    });
    await mockRepo.saveKeyboardShortcuts([shortcut.serialize()]);

    expect(
      await service.findShortcutByKeys(["Control", "Shift", "1"])
    ).not.toBeNull();
    expect(
      await service.findShortcutByKeys(["Shift", "Control", "1"])
    ).toBeNull();
    expect(await service.findShortcutByKeys(["Control", "1"])).toBeNull();
  });

  it("executes ShowContentEvent via keyboard and emits showContent with manual flag", async () => {
    const event = (
      await import("../../../domains/app-event/show-content/show-content-event")
    ).ShowContentEvent.fromData({
      id: "e4",
      contentType: "image",
      contentId: "img-1",
      processedAt: null,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const shortcut = new KeyboardShortcut({
      id: "s4",
      keys: ["Control", "2"],
      actions: [event],
    });
    await mockRepo.saveKeyboardShortcuts([shortcut.serialize()]);

    const spy = vi.fn();
    eventBus.on("showContent", spy);

    const found = await service.findShortcutByKeys(["Control", "2"]);
    expect(found).not.toBeNull();

    await found!.execute();

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        contentType: "image",
        contentId: "img-1",
        manual: true,
      })
    );
  });
});
