import { describe, it, expect, beforeEach, vi } from "vitest";
import { container } from "tsyringe";
import { MemberRepository } from "./member-repository";
import { AccountsRepository } from "@octopus/accounts";
import type { Member as DirectoryMember } from "@octopus/accounts";
import { IJackpotGameApiToken } from "../../../server/jackpot-api-contract";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

function createMockJackpotApi() {
  return {
    addDriveData: vi.fn(),
    getDriveMetaData: vi.fn(),
    getDriveData: vi.fn(),
    updateDriveData: vi.fn(),
    addJson: vi.fn(),
    getJson: vi.fn(async () => ({ json: "[]", updatedAt: null })),
  };
}

function createMockDirectory(initial: DirectoryMember[] = []) {
  const members = [...initial];
  let nextId = 1;
  return {
    listMembers: vi.fn(async () => [...members]),
    addMember: vi.fn(async (args: { id?: string; name: string }) => {
      const id = args.id || `generated-${nextId++}`;
      const created = { id, name: args.name };
      members.push(created);
      return created;
    }),
    updateMember: vi.fn(async (args: { id: string; name: string }) => {
      const index = members.findIndex((m) => m.id === args.id);
      if (index === -1) throw new Error("not found");
      members[index] = { id: args.id, name: args.name };
      return members[index];
    }),
    deleteMember: vi.fn(async () => undefined),
    replaceAllMembers: vi.fn(async () => ({ replaced: 0 })),
  };
}

describe("MemberRepository (jackpot)", () => {
  let mockDirectory: ReturnType<typeof createMockDirectory>;
  let repo: MemberRepository;

  beforeEach(() => {
    container.reset();
    mockDirectory = createMockDirectory();
    container.register(AccountsRepository, { useValue: mockDirectory as any });
    container.register(IJackpotGameApiToken, { useValue: createMockJackpotApi() as any });
    repo = container.resolve(MemberRepository);
  });

  it("creates a new shared member when adding without an existing id", async () => {
    const added = await repo.addMembers([{ id: "", name: "太郎", rank: 3 }]);
    expect(added).toHaveLength(1);
    expect(added[0].name).toBe("太郎");
    expect(added[0].rank).toBe(3);
    expect(mockDirectory.addMember).toHaveBeenCalledWith({ id: undefined, name: "太郎" });

    const members = await repo.getMembers();
    expect(members).toEqual([expect.objectContaining({ name: "太郎", rank: 3 })]);
  });

  it("attaches to an existing shared member without creating a duplicate", async () => {
    mockDirectory = createMockDirectory([{ id: "shared-1", name: "既存メンバー" }]);
    container.register(AccountsRepository, { useValue: mockDirectory as any });
    repo = container.resolve(MemberRepository);

    const added = await repo.addMembers([
      { id: "shared-1", name: "既存メンバー", rank: 2 },
    ]);
    expect(added[0]).toEqual(
      expect.objectContaining({ id: "shared-1", name: "既存メンバー", rank: 2 })
    );
    expect(mockDirectory.addMember).not.toHaveBeenCalled();
  });

  it("当選しやすさ(weight)を保存して読み出せ、更新でき、設定を初期値に戻すと既定(未設定)に戻る", async () => {
    mockDirectory = createMockDirectory([{ id: "shared-1", name: "既存メンバー" }]);
    container.register(AccountsRepository, { useValue: mockDirectory as any });
    repo = container.resolve(MemberRepository);

    await repo.addMembers([{ id: "shared-1", name: "既存メンバー", rank: 4, weight: 50 }]);
    expect((await repo.getMembers())[0].weight).toBe(50);

    await repo.updateMembers([{ id: "shared-1", updateFn: (m) => ({ ...m, weight: 80 }) }]);
    expect((await repo.getMemberById("shared-1"))?.weight).toBe(80);

    await repo.deleteMembers(["shared-1"]);
    expect((await repo.getMembers())[0].weight).toBeUndefined();
  });

  it("weight を設定していないメンバーは weight が未設定のまま（抽選では既定値として扱われる）", async () => {
    await repo.addMembers([{ id: "", name: "花子", rank: 2 }]);
    expect((await repo.getMembers())[0].weight).toBeUndefined();
  });

  it("deleteMembers only removes the local extra, not the shared member", async () => {
    mockDirectory = createMockDirectory([{ id: "shared-1", name: "既存メンバー" }]);
    container.register(AccountsRepository, { useValue: mockDirectory as any });
    repo = container.resolve(MemberRepository);

    await repo.addMembers([{ id: "shared-1", name: "既存メンバー", rank: 4 }]);
    await repo.deleteMembers(["shared-1"]);

    expect(mockDirectory.deleteMember).not.toHaveBeenCalled();
    const members = await repo.getMembers();
    // 拡張データは消えるが、共有マスタのメンバー自体は残るためデフォルトrankで表示される
    // （メンバーは名簿にいる限りジャックポットのメンバーでもある。外す操作ではなく「設定を初期値に戻す」操作）。
    expect(members).toEqual([
      expect.objectContaining({ id: "shared-1", name: "既存メンバー", rank: 5 }),
    ]);
  });
});

describe("MemberRepository.listSyncTargets", () => {
  let mockDirectory: ReturnType<typeof createMockDirectory>;
  let mockJackpotApi: ReturnType<typeof createMockJackpotApi>;
  let repo: MemberRepository;

  beforeEach(async () => {
    container.reset();
    localStorage.clear();
    // MemberExtraData/SyncDirtyTrackerはjsdomのlocalforageを介したグローバルな
    // ストアなので、他のdescribeブロックの残留データから隔離するため明示的に消す。
    await new LocalStorageService("jackpot-game", "MemberExtraData").clear();
    await new LocalStorageService("jackpot-game", "SyncDirtyTracker").clear();
    mockDirectory = createMockDirectory([{ id: "shared-1", name: "既存メンバー" }]);
    mockJackpotApi = createMockJackpotApi();
    container.register(AccountsRepository, { useValue: mockDirectory as any });
    container.register(IJackpotGameApiToken, { useValue: mockJackpotApi as any });
    repo = container.resolve(MemberRepository);
  });

  it("returns no local snapshot when no extras have ever been saved", async () => {
    const [target] = await repo.listSyncTargets();
    expect(await target.getLocal()).toBeNull();
  });

  it("returns no remote snapshot until a fileId has been learned (nothing pushed/pulled yet)", async () => {
    const [target] = await repo.listSyncTargets();
    expect(await target.getRemote()).toBeNull();
    expect(mockJackpotApi.getJson).not.toHaveBeenCalled();
  });

  it("push uploads local extras and remembers the returned fileId for later pulls", async () => {
    await repo.addMembers([{ id: "shared-1", name: "既存メンバー", rank: 4 }]);
    mockJackpotApi.addJson.mockResolvedValue({
      fileId: "folder1/member-extras.json",
      driveDataId: "folder1/member-extras.json",
      parentFolderId: "folder1",
      lastUpdate: new Date().toISOString(),
    });

    const [target] = await repo.listSyncTargets();
    const local = await target.getLocal();
    expect(local).not.toBeNull();
    await target.push(local!.data);

    expect(mockJackpotApi.addJson).toHaveBeenCalledOnce();
    expect(localStorage.getItem("jackpot-member-extras-file-id")).toBe(
      "folder1/member-extras.json"
    );
  });

  it("pull replaces local extras with the remote snapshot", async () => {
    const [target] = await repo.listSyncTargets();
    await target.pull([{ memberId: "shared-1", rank: 9 }]);

    const members = await repo.getMembers();
    expect(members).toEqual([
      expect.objectContaining({ id: "shared-1", rank: 9 }),
    ]);
  });
});
