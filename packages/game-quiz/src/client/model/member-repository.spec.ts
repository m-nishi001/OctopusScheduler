import { describe, it, expect, vi } from "vitest";
import type { QuizGameApi } from "../../server/quiz-api-contract";
import { MemberRepository } from "./member-repository";

function createFakeApi(overrides: Partial<QuizGameApi> = {}): QuizGameApi {
  return {
    listMembers: vi.fn(),
    addMember: vi.fn(),
    updateMember: vi.fn(),
    deleteMember: vi.fn(),
    ...overrides,
  } as unknown as QuizGameApi;
}

describe("MemberRepository", () => {
  it("lists members via the API", async () => {
    const api = createFakeApi({
      listMembers: vi.fn().mockResolvedValue([{ userId: "u1", displayName: "太郎" }]),
    });
    const repo = new MemberRepository(api);

    await expect(repo.listMembers()).resolves.toEqual([{ userId: "u1", displayName: "太郎" }]);
    expect(api.listMembers).toHaveBeenCalledWith({});
  });

  it("adds a member via the API", async () => {
    const api = createFakeApi({
      addMember: vi.fn().mockResolvedValue({ userId: "u1", displayName: "太郎" }),
    });
    const repo = new MemberRepository(api);

    await repo.addMember({ userId: "u1", displayName: "太郎" });

    expect(api.addMember).toHaveBeenCalledWith({ userId: "u1", displayName: "太郎" });
  });

  it("updates a member via the API", async () => {
    const api = createFakeApi({
      updateMember: vi.fn().mockResolvedValue({ userId: "u1", displayName: "次郎" }),
    });
    const repo = new MemberRepository(api);

    await repo.updateMember({ userId: "u1", displayName: "次郎" });

    expect(api.updateMember).toHaveBeenCalledWith({ userId: "u1", displayName: "次郎" });
  });

  it("deletes a member via the API", async () => {
    const api = createFakeApi({ deleteMember: vi.fn().mockResolvedValue(undefined) });
    const repo = new MemberRepository(api);

    await repo.deleteMember("u1");

    expect(api.deleteMember).toHaveBeenCalledWith({ userId: "u1" });
  });
});
