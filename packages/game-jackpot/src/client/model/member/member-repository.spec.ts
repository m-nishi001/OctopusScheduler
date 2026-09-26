import { describe, it, expect, beforeEach, vi } from "vitest";
import { container } from "tsyringe";
import { MemberRepository } from "./member-repository";
import { MemberDirectoryRepository } from "@octopus/member-directory";
import type { Member as DirectoryMember } from "@octopus/member-directory";

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

  beforeEach(async () => {
    container.reset();
    mockDirectory = createMockDirectory();
    container.register(MemberDirectoryRepository, { useValue: mockDirectory as any });
    repo = container.resolve(MemberRepository);
    // 各テストのローカル拡張ストレージを分離する(localforageはグローバルなので明示的にクリア)。
    await repo.clearRosterOverride();
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
    container.register(MemberDirectoryRepository, { useValue: mockDirectory as any });
    repo = container.resolve(MemberRepository);

    const added = await repo.addMembers([
      { id: "shared-1", name: "既存メンバー", rank: 2 },
    ]);
    expect(added[0]).toEqual(
      expect.objectContaining({ id: "shared-1", name: "既存メンバー", rank: 2 })
    );
    expect(mockDirectory.addMember).not.toHaveBeenCalled();
  });

  it("deleteMembers only removes the local extra, not the shared member", async () => {
    mockDirectory = createMockDirectory([{ id: "shared-1", name: "既存メンバー" }]);
    container.register(MemberDirectoryRepository, { useValue: mockDirectory as any });
    repo = container.resolve(MemberRepository);

    await repo.addMembers([{ id: "shared-1", name: "既存メンバー", rank: 4 }]);
    await repo.deleteMembers(["shared-1"]);

    expect(mockDirectory.deleteMember).not.toHaveBeenCalled();
    const members = await repo.getMembers();
    // 拡張データは消えるが、共有マスタのメンバー自体は残るためデフォルトrankで表示される。
    expect(members).toEqual([
      expect.objectContaining({ id: "shared-1", name: "既存メンバー", rank: 5 }),
    ]);
  });

  it("setRosterOverride/clearRosterOverride never call the shared directory", async () => {
    await repo.setRosterOverride([{ id: "dummy-1", name: "テスト", rank: 1 }]);
    expect(await repo.getMembers()).toEqual([
      { id: "dummy-1", name: "テスト", rank: 1 },
    ]);
    expect(mockDirectory.addMember).not.toHaveBeenCalled();
    expect(mockDirectory.replaceAllMembers).not.toHaveBeenCalled();

    await repo.clearRosterOverride();
    expect(await repo.getMembers()).toEqual([]);
  });
});
