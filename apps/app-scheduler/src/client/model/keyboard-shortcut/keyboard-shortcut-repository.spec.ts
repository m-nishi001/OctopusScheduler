import { describe, it, expect, beforeEach, vi } from "vitest";
import { KeyboardShortcutRepository } from "./keyboard-shortcut-repository";
import { KeyboardShortcut } from "./keyboard-shortcut";
import { KeyboardShortcutConfig } from "./keyboard-shortcut-config";
import type { KeyboardShortcutWireItem } from "../../../server/scheduler-api-contract";

describe("KeyboardShortcutRepository (GAS sync round-trip)", () => {
  let serverShortcuts: KeyboardShortcutWireItem[] = [];
  let serverConfig: unknown = { enabled: true };
  const fakeApi = {
    getKeyboardShortcuts: vi.fn(async () => ({
      shortcuts: serverShortcuts,
      config: serverConfig,
    })),
    setKeyboardShortcuts: vi.fn(
      async (payload: { shortcuts: KeyboardShortcutWireItem[]; config: unknown }) => {
        serverShortcuts = payload.shortcuts;
        serverConfig = payload.config;
      }
    ),
  } as any;

  let repo: KeyboardShortcutRepository;

  beforeEach(async () => {
    serverShortcuts = [];
    serverConfig = { enabled: true };
    repo = new KeyboardShortcutRepository(fakeApi);
    // start each test from an empty local slate
    await repo.saveKeyboardShortcuts([]);
  });

  it("round-trips shortcuts and config through local-to-gas then gas-to-local", async () => {
    const shortcuts = [
      new KeyboardShortcut({
        id: "s1",
        keys: ["Control", "1"],
        eventIds: ["e1", "e2"],
      }),
      new KeyboardShortcut({ id: "s2", keys: ["Control", "2"], eventIds: [] }),
    ];
    await repo.saveKeyboardShortcuts(shortcuts);
    await repo.saveConfig(new KeyboardShortcutConfig(false));

    await repo.syncWithServer("local-to-gas");

    // The server receives the canonical {id, keys, eventIds} shape directly,
    // with no legacy positional-array encoding.
    expect(serverShortcuts).toEqual([
      { id: "s1", keys: ["Control", "1"], eventIds: ["e1", "e2"] },
      { id: "s2", keys: ["Control", "2"], eventIds: [] },
    ]);
    expect(serverConfig).toEqual({ enabled: false });

    // Simulate a fresh device: wipe local storage, then pull from the server.
    await repo.saveKeyboardShortcuts([]);
    await repo.saveConfig(KeyboardShortcutConfig.createEmpty());

    await repo.syncWithServer("gas-to-local");

    const restored = await repo.getKeyboardShortcutsRaw();
    expect(restored).toEqual([
      { id: "s1", keys: ["Control", "1"], eventIds: ["e1", "e2"] },
      { id: "s2", keys: ["Control", "2"], eventIds: [] },
    ]);
    const restoredConfig = await repo.getConfig();
    expect(restoredConfig.enabled).toBe(false);
  });
});
