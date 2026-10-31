import { describe, it, expect, beforeEach, vi } from "vitest";
import { container } from "tsyringe";
import { MemberRepository } from "./member-repository";
import { AccountsRepository } from "@octopus/accounts";
import type { Member as DirectoryMember } from "@octopus/accounts";
import { IJackpotGameApiToken } from "../../../server/jackpot-api-contract";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";

function createMockJackpotApi() {
  return {
    addJson: vi.fn(async (_blob: { fileName: string; json: string }) => undefined),
    getJson: vi.fn(async (_fileName: string): Promise<{ json: string | null }> => ({ json: null })),
  };
}

function createMockDirectory(initial: DirectoryMember[] = []) {
  const members = [...initial];
  let nextId = 1;
  return {
    listMembers: vi.fn(async () => [...members]),
    addMember: vi.fn(async (args: { id?: string; name: string }) => {
      const id = args.id || `generated-${nextId++}`;
      const created: DirectoryMember = { id, name: args.name };
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

  beforeEach(async () => {
    await new LocalStorageService("jackpot-game", "MemberExtraData").clear();
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

  it("名簿の写真(photo)は名簿から読み、ジャックポット側には写真を保存しない", async () => {
    mockDirectory = createMockDirectory([{ id: "s1", name: "写真あり", photo: "aaaaaaaaaaaaaaaa" }, { id: "s2", name: "写真なし" }]);
    container.register(AccountsRepository, { useValue: mockDirectory as any });
    repo = container.resolve(MemberRepository);
    await repo.addMembers([{ id: "s1", name: "写真あり", rank: 2 }]);
    const members = await repo.getMembers();
    expect(members.find((m) => m.id === "s1")?.photo).toBe("aaaaaaaaaaaaaaaa");
    expect(members.find((m) => m.id === "s2")?.photo).toBeUndefined();
    const record = await new LocalStorageService("jackpot-game", "MemberExtraData").get<{ data: Record<string, unknown>[] }>("record");
    const stored = record?.data.find((e) => e.memberId === "s1");
    expect(Object.keys(stored ?? {}).sort()).toEqual(["memberId", "rank"]);
  });

  it("setExtras: 名簿にいる id の rank / weight を設定し(省略は保つ)、名簿にいない id は作らずに返す", async () => {
    mockDirectory = createMockDirectory([{ id: "s1", name: "A" }, { id: "s2", name: "B" }]);
    container.register(AccountsRepository, { useValue: mockDirectory as any });
    repo = container.resolve(MemberRepository);
    await repo.addMembers([{ id: "s1", name: "A", rank: 2, weight: 30 }]);
    const result = await repo.setExtras([{ id: "s1", rank: 7 }, { id: "s2", weight: 90 }, { id: "ghost", rank: 1 }]);
    expect(result).toEqual({ updated: 2, unknown: ["ghost"] });
    const members = await repo.getMembers();
    expect(members.find((m) => m.id === "s1")).toMatchObject({ rank: 7, weight: 30 });
    expect(members.find((m) => m.id === "s2")).toMatchObject({ rank: 5, weight: 90 });
    expect(members.some((m) => m.id === "ghost")).toBe(false);
    expect(mockDirectory.addMember).not.toHaveBeenCalled();
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
    // MemberExtraDataはjsdomのlocalforageを介したグローバルな
    // ストアなので、他のdescribeブロックの残留データから隔離するため明示的に消す。
    await new LocalStorageService("jackpot-game", "MemberExtraData").clear();
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

  it("getRemote reads member-extras.json as { data, updatedAt } (no fileId to learn first)", async () => {
    mockJackpotApi.getJson.mockResolvedValueOnce({ json: JSON.stringify({ updatedAt: 55, data: [{ memberId: "shared-1", rank: 2 }] }) });
    const [target] = await repo.listSyncTargets();
    expect(await target.getRemote()).toEqual({ updatedAt: 55, data: [{ memberId: "shared-1", rank: 2 }] });
    expect(mockJackpotApi.getJson).toHaveBeenCalledWith("member-extras.json");
  });

  it("push uploads { updatedAt, data } as-is and writes nothing back locally", async () => {
    await repo.addMembers([{ id: "shared-1", name: "既存メンバー", rank: 4 }]);

    const [target] = await repo.listSyncTargets();
    const local = (await target.getLocal())!;
    await target.push(local);

    expect(mockJackpotApi.addJson).toHaveBeenCalledOnce();
    const payload = mockJackpotApi.addJson.mock.calls[0][0];
    expect(payload.fileName).toBe("member-extras.json");
    expect(JSON.parse(payload.json)).toEqual({ updatedAt: local.updatedAt, data: [{ memberId: "shared-1", rank: 4 }] });
    expect(await target.getLocal()).toEqual(local);
  });

  it("an edit made while pushing keeps a newer local updatedAt (sent again next time)", async () => {
    await repo.addMembers([{ id: "shared-1", name: "既存メンバー", rank: 4 }]);
    const [target] = await repo.listSyncTargets();
    const sent = (await target.getLocal())!;
    mockJackpotApi.addJson.mockImplementationOnce(async () => {
      await repo.setExtras([{ id: "shared-1", rank: 7 }]);
    });
    await target.push(sent);

    const local = (await target.getLocal())!;
    expect(local.updatedAt).toBeGreaterThan(sent.updatedAt);
    expect(local.data).toEqual([expect.objectContaining({ memberId: "shared-1", rank: 7 })]);
  });

  it("pull replaces local extras with the remote record and keeps its updatedAt", async () => {
    const [target] = await repo.listSyncTargets();
    await target.pull({ data: [{ memberId: "shared-1", rank: 9 }], updatedAt: 777 }, null);

    const members = await repo.getMembers();
    expect(members).toEqual([
      expect.objectContaining({ id: "shared-1", rank: 9 }),
    ]);
    expect((await target.getLocal())!.updatedAt).toBe(777);
  });

  it("deleting every extra leaves an empty record that is still synced (distinct from no data)", async () => {
    await repo.addMembers([{ id: "shared-1", name: "既存メンバー", rank: 4 }]);
    await repo.deleteMembers(["shared-1"]);
    const [target] = await repo.listSyncTargets();
    expect((await target.getLocal())!.data).toEqual([]);
  });
});
