import { describe, it, expect, beforeEach, vi } from "vitest";
import { KeyboardShortcutRepository } from "./keyboard-shortcut-repository";
import { KeyboardShortcut } from "./keyboard-shortcut";
import { KeyboardShortcutConfig } from "./keyboard-shortcut-config";
import type { KeyboardShortcutWireItem } from "../../../server/scheduler-api-contract";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

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
    fakeApi.setKeyboardShortcuts.mockClear();
    await new LocalStorageService("octopus-scheduler", "KeyboardShortcut").clear();
    repo = new KeyboardShortcutRepository(fakeApi);
  });

  const one = () => [new KeyboardShortcut({ id: "s1", keys: ["Control", "1"], eventIds: ["e1"] })];

  it("何も保存していなければ、ローカルもリモートも null", async () => {
    const targets = await repo.listSyncTargets();
    expect(targets).toHaveLength(1);
    const [target] = targets;
    expect(await target.getLocal()).toBeNull();
    expect(await target.getRemote()).toBeNull();
  });

  it("ローカルだけにデータがあれば、そのままサーバーへ送る(更新日時もローカルのもの)", async () => {
    await repo.saveKeyboardShortcuts([
      new KeyboardShortcut({ id: "s1", keys: ["Control", "1"], eventIds: ["e1", "e2"] }),
    ]);
    await repo.saveConfig(new KeyboardShortcutConfig(false));

    const [target] = await repo.listSyncTargets();
    const local = (await target.getLocal())!;
    await target.push(local);

    expect(serverShortcuts).toEqual([{ id: "s1", keys: ["Control", "1"], eventIds: ["e1", "e2"] }]);
    expect(serverConfig).toEqual({ enabled: false });
    expect(serverUpdatedAt).toBe(new Date(local.updatedAt).toISOString());
    // 書き戻しが無いので、送った直後はローカルとリモートの更新日時が一致する
    expect((await target.getRemote())!.updatedAt).toBe((await target.getLocal())!.updatedAt);
  });

  it("送信中に編集すると、ローカルの更新日時のほうが新しいまま残る(次の同期でまた送られる)", async () => {
    await repo.saveKeyboardShortcuts(one());
    const [target] = await repo.listSyncTargets();
    const sent = (await target.getLocal())!;
    fakeApi.setKeyboardShortcuts.mockImplementationOnce(async (payload: any) => {
      await repo.saveConfig(new KeyboardShortcutConfig(false)); // 送信の最中の編集
      serverShortcuts = payload.shortcuts;
      serverConfig = payload.config;
      serverUpdatedAt = payload.updatedAt;
    });
    await target.push(sent);

    expect((await target.getLocal())!.updatedAt).toBeGreaterThan((await target.getRemote())!.updatedAt);
    expect((await repo.getConfig()).enabled).toBe(false);
  });

  it("リモートだけにデータがあれば、取り込んでローカルに書く(更新日時もリモートのまま)", async () => {
    serverShortcuts = [{ id: "s1", keys: ["Control", "1"], eventIds: [] }];
    serverConfig = { enabled: false };
    serverUpdatedAt = new Date().toISOString();

    const [target] = await repo.listSyncTargets();
    const remote = (await target.getRemote())!;
    await target.pull(remote, await target.getLocal());

    expect(await repo.getKeyboardShortcutsRaw()).toEqual([{ id: "s1", keys: ["Control", "1"], eventIds: [] }]);
    expect((await repo.getConfig()).enabled).toBe(false);
    expect((await target.getLocal())!.updatedAt).toBe(remote.updatedAt);
  });

  it("取り込みの途中に編集されたら書かずに false を返し、編集が残る", async () => {
    await repo.saveKeyboardShortcuts(one());
    const [target] = await repo.listSyncTargets();
    const decided = await target.getLocal();
    await repo.saveKeyboardShortcuts([]); // 判定のあとの編集

    const applied = await target.pull(
      { data: { shortcuts: [{ id: "r", keys: ["2"], eventIds: [] }], config: { enabled: true } }, updatedAt: decided!.updatedAt + 100_000 },
      decided
    );

    expect(applied).toBe(false);
    expect(await repo.getKeyboardShortcutsRaw()).toEqual([]);
  });

  it("ショートカットの保存は設定を、設定の保存はショートカットを変えない", async () => {
    await repo.saveKeyboardShortcuts(one());
    await repo.saveConfig(new KeyboardShortcutConfig(false));
    expect(await repo.getKeyboardShortcutsRaw()).toHaveLength(1);
    await repo.saveKeyboardShortcuts([]);
    expect((await repo.getConfig()).enabled).toBe(false);
  });

  it("更新日時の無い(一度も保存されていない)サーバーは「データなし」", async () => {
    const [target] = await repo.listSyncTargets();
    expect(await target.getRemote()).toBeNull();
  });

  describe("最後の1件を削除したとき", () => {
    it("「データなし」ではなく「空にした」記録として残り、空の一覧をサーバーへ送る(削除が別の端末にも伝わる)", async () => {
      await repo.saveKeyboardShortcuts(one());
      const [target] = await repo.listSyncTargets();
      await target.push((await target.getLocal())!);
      expect(serverShortcuts).toHaveLength(1);

      await repo.saveKeyboardShortcuts([]); // 最後の1件を削除
      const local = (await target.getLocal())!;
      expect(local.data.shortcuts).toEqual([]);

      await target.push(local);
      expect(serverShortcuts).toEqual([]);
      expect(serverUpdatedAt).not.toBeNull();
    });

    it("別の端末は、サーバーの空の一覧(更新日時あり)を最新として取り込み、自分の分も空にする", async () => {
      await repo.saveKeyboardShortcuts(one());
      serverShortcuts = [];
      serverConfig = { enabled: true };
      serverUpdatedAt = new Date(Date.now() + 60_000).toISOString();

      const [target] = await repo.listSyncTargets();
      const remote = (await target.getRemote())!;
      expect(remote.data.shortcuts).toEqual([]);
      await target.pull(remote, await target.getLocal());
      expect(await repo.getKeyboardShortcutsRaw()).toEqual([]);
    });
  });
});
