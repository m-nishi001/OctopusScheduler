import { describe, it, expect, beforeEach, vi } from "vitest";
import { KeyboardShortcutRepository } from "./keyboard-shortcut-repository";
import { KeyboardShortcut } from "./keyboard-shortcut";
import { KeyboardShortcutConfig } from "./keyboard-shortcut-config";
import type { KeyboardShortcutWireItem } from "../../../server/scheduler-api-contract";

describe("KeyboardShortcutRepository.listSyncTargets", () => {
  let serverShortcuts: KeyboardShortcutWireItem[] = [];
  let serverConfig: unknown = { enabled: true };
  let serverUpdatedAt: string | null = null;
  const fakeApi = {
    getKeyboardShortcuts: vi.fn(async () => ({
      shortcuts: serverShortcuts,
      config: serverConfig,
      updatedAt: serverUpdatedAt,
    })),
    setKeyboardShortcuts: vi.fn(
      async (payload: {
        shortcuts: KeyboardShortcutWireItem[];
        config: unknown;
        updatedAt: string;
      }) => {
        serverShortcuts = payload.shortcuts;
        serverConfig = payload.config;
        serverUpdatedAt = payload.updatedAt;
      }
    ),
  } as any;

  let repo: KeyboardShortcutRepository;

  beforeEach(async () => {
    serverShortcuts = [];
    serverConfig = { enabled: true };
    serverUpdatedAt = null;
    repo = new KeyboardShortcutRepository(fakeApi);
    // start each test from an empty local slate
    await repo.saveKeyboardShortcuts([]);
  });

  it("returns no target when neither local nor remote has any shortcuts", async () => {
    await repo.saveKeyboardShortcuts([]);
    const targets = await repo.listSyncTargets();
    expect(targets).toHaveLength(1);
    const [target] = targets;
    expect(await target.getLocal()).toBeNull();
    expect(await target.getRemote()).toBeNull();
  });

  it("pushes local shortcuts to the server when only local data exists", async () => {
    const shortcuts = [
      new KeyboardShortcut({
        id: "s1",
        keys: ["Control", "1"],
        eventIds: ["e1", "e2"],
      }),
    ];
    await repo.saveKeyboardShortcuts(shortcuts);
    await repo.saveConfig(new KeyboardShortcutConfig(false));

    const [target] = await repo.listSyncTargets();
    const local = await target.getLocal();
    expect(local).not.toBeNull();
    await target.push(local!.data);

    expect(serverShortcuts).toEqual([
      { id: "s1", keys: ["Control", "1"], eventIds: ["e1", "e2"] },
    ]);
    expect(serverConfig).toEqual({ enabled: false });
    expect(serverUpdatedAt).not.toBeNull();
  });

  it("pulls remote shortcuts into local storage when only remote data exists", async () => {
    serverShortcuts = [{ id: "s1", keys: ["Control", "1"], eventIds: [] }];
    serverConfig = { enabled: false };
    serverUpdatedAt = new Date().toISOString();

    const [target] = await repo.listSyncTargets();
    const remote = await target.getRemote();
    expect(remote).not.toBeNull();
    await target.pull(remote!.data);

    const restored = await repo.getKeyboardShortcutsRaw();
    expect(restored).toEqual([
      { id: "s1", keys: ["Control", "1"], eventIds: [] },
    ]);
    expect((await repo.getConfig()).enabled).toBe(false);
  });

  it("treats remote data with no updatedAt (legacy) as older than freshly tracked local data", async () => {
    await repo.saveKeyboardShortcuts([
      new KeyboardShortcut({ id: "s1", keys: ["1"], eventIds: [] }),
    ]);
    serverShortcuts = [{ id: "legacy", keys: ["2"], eventIds: [] }];
    serverConfig = { enabled: true };
    serverUpdatedAt = null;

    const [target] = await repo.listSyncTargets();
    const local = await target.getLocal();
    const remote = await target.getRemote();
    expect(local!.updatedAt).toBeGreaterThan(remote!.updatedAt);
  });
});
