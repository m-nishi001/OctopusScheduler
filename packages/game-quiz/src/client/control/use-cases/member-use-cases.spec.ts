import { describe, it, expect, vi } from "vitest";
import type { MemberRepository } from "../../model/member-repository";
import { ListMembersUseCase } from "./list-members-use-case";
import { AddMemberUseCase } from "./add-member-use-case";
import { UpdateMemberUseCase } from "./update-member-use-case";
import { DeleteMemberUseCase } from "./delete-member-use-case";

function createFakeRepository(overrides: Partial<MemberRepository> = {}): MemberRepository {
  return {
    listMembers: vi.fn(),
    addMember: vi.fn(),
    updateMember: vi.fn(),
    deleteMember: vi.fn(),
    ...overrides,
  } as unknown as MemberRepository;
}

describe("member use-cases", () => {
  it("ListMembersUseCase delegates to the repository", async () => {
    const repository = createFakeRepository({
      listMembers: vi.fn().mockResolvedValue([{ userId: "u1", displayName: "太郎" }]),
    });

    await expect(new ListMembersUseCase(repository).execute()).resolves.toEqual([
      { userId: "u1", displayName: "太郎" },
    ]);
  });

  it("AddMemberUseCase delegates to the repository", async () => {
    const repository = createFakeRepository({
      addMember: vi.fn().mockResolvedValue({ userId: "u1", displayName: "太郎" }),
    });

    await new AddMemberUseCase(repository).execute({ userId: "u1", displayName: "太郎" });

    expect(repository.addMember).toHaveBeenCalledWith({ userId: "u1", displayName: "太郎" });
  });

  it("UpdateMemberUseCase delegates to the repository", async () => {
    const repository = createFakeRepository({
      updateMember: vi.fn().mockResolvedValue({ userId: "u1", displayName: "次郎" }),
    });

    await new UpdateMemberUseCase(repository).execute({ userId: "u1", displayName: "次郎" });

    expect(repository.updateMember).toHaveBeenCalledWith({ userId: "u1", displayName: "次郎" });
  });

  it("DeleteMemberUseCase delegates to the repository", async () => {
    const repository = createFakeRepository({ deleteMember: vi.fn().mockResolvedValue(undefined) });

    await new DeleteMemberUseCase(repository).execute("u1");

    expect(repository.deleteMember).toHaveBeenCalledWith("u1");
  });
});
