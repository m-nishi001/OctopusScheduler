import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerKeyboardShortcutListener } from "./keyboard-shortcut-listener";
import { Container } from "../../../core/container/index";
import { container } from "tsyringe";
import { KeyboardShortcutService } from "../../../model/applications/keyboard-shortcut/keyboard-shortcut-service";
import { KeyboardShortcutConfig } from "../../../model/domains/keyboard-shortcut/keyboard-shortcut-config";
import { eventBus } from "../../../core/event-bus";

describe("keyboard-shortcut-listener", () => {
  let unregister: () => void;
  beforeEach(async () => {
    Container.Register();
    const keyboardShortcutService = container.resolve(KeyboardShortcutService);
    // ensure keyboard shortcuts are enabled in test environment
    await keyboardShortcutService.saveConfig(new KeyboardShortcutConfig(true));
    unregister = registerKeyboardShortcutListener();
  });
  afterEach(() => {
    unregister();
    (eventBus as any).all.clear?.();
  });

  it("emits stopAudio when ESC key is pressed", () => {
    const spy = vi.fn();
    eventBus.on("stopAudio", spy);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(spy).toHaveBeenCalled();
  });
});
