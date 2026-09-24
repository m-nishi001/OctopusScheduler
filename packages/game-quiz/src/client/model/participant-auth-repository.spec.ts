import { describe, it, expect, vi } from "vitest";
import type { QuizGameApi } from "../../server/quiz-api-contract";
import { ParticipantAuthRepository } from "./participant-auth-repository";

function createFakeApi(overrides: Partial<QuizGameApi> = {}): QuizGameApi {
  return {
    loginParticipant: vi.fn(),
    resolveDeviceToken: vi.fn(),
    ...overrides,
  } as unknown as QuizGameApi;
}

describe("ParticipantAuthRepository", () => {
  it("logs in via the API", async () => {
    const session = { token: "tok-1", userId: "u1", displayName: "太郎" };
    const api = createFakeApi({ loginParticipant: vi.fn().mockResolvedValue(session) });
    const repo = new ParticipantAuthRepository(api);

    await expect(repo.login("u1")).resolves.toEqual(session);
    expect(api.loginParticipant).toHaveBeenCalledWith({ userId: "u1" });
  });

  it("resolves a device token via the API", async () => {
    const session = { token: "tok-1", userId: "u1", displayName: "太郎" };
    const api = createFakeApi({ resolveDeviceToken: vi.fn().mockResolvedValue(session) });
    const repo = new ParticipantAuthRepository(api);

    await expect(repo.resolveToken("tok-1")).resolves.toEqual(session);
    expect(api.resolveDeviceToken).toHaveBeenCalledWith({ token: "tok-1" });
  });
});
