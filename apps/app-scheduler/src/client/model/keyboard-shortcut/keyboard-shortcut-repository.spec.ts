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

  describe("最後の1件を削除したとき", () => {
    const one = () => [new KeyboardShortcut({ id: "s1", keys: ["Control", "1"], eventIds: [] })];

    it("「データなし」ではなく「空にした」として扱い、空の一覧をサーバーへ送る(削除が別の端末にも伝わる)", async () => {
      await repo.saveKeyboardShortcuts(one());
      const [target] = await repo.listSyncTargets();
      await target.push((await target.getLocal())!.data);
      expect(serverShortcuts).toHaveLength(1);

      await repo.saveKeyboardShortcuts([]); // 最後の1件を削除
      const local = await target.getLocal();
      expect(local).not.toBeNull();
      expect(local!.data.shortcuts).toEqual([]);

      await target.push(local!.data);
      expect(serverShortcuts).toEqual([]);
      expect(serverUpdatedAt).not.toBeNull();
    });

    it("送ったあとは、ふつうの「空」(データなし)に戻る", async () => {
      await repo.saveKeyboardShortcuts(one());
      await repo.saveKeyboardShortcuts([]);
      const [target] = await repo.listSyncTargets();
      await target.push((await target.getLocal())!.data);
      expect(await target.getLocal()).toBeNull();
    });

    it("空にしたあとで、もう一度空を保存しても、削除は同期の対象のまま", async () => {
      await repo.saveKeyboardShortcuts(one());
      await repo.saveKeyboardShortcuts([]);
      await repo.saveKeyboardShortcuts([]);
      const [target] = await repo.listSyncTargets();
      expect(await target.getLocal()).not.toBeNull();
    });

    it("別の端末は、サーバーの空の一覧(更新日時あり)を最新として取り込み、自分の分も空にする", async () => {
      await repo.saveKeyboardShortcuts(one());
      serverShortcuts = [];
      serverConfig = { enabled: true };
      serverUpdatedAt = new Date(Date.now() + 60_000).toISOString();

      const [target] = await repo.listSyncTargets();
      const remote = await target.getRemote();
      expect(remote).not.toBeNull();
      expect(remote!.data.shortcuts).toEqual([]);
      await target.pull(remote!.data);
      expect(await repo.getKeyboardShortcutsRaw()).toEqual([]);
    });

    it("一度も保存されていないサーバー(更新日時も中身も無い)は、これまでどおり「データなし」", async () => {
      const [target] = await repo.listSyncTargets();
      expect(await target.getRemote()).toBeNull();
    });
  });
});
