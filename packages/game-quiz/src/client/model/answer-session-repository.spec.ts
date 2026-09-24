import { describe, it, expect, vi } from "vitest";
import type { QuizGameApi } from "../../server/quiz-api-contract";
import { AnswerSessionRepository } from "./answer-session-repository";

function createFakeApi(overrides: Partial<QuizGameApi> = {}): QuizGameApi {
  return {
    startAcceptingAnswers: vi.fn(),
    stopAcceptingAnswers: vi.fn(),
    getAcceptanceState: vi.fn(),
    submitAnswer: vi.fn(),
    getAnswers: vi.fn(),
    ...overrides,
  } as unknown as QuizGameApi;
}

describe("AnswerSessionRepository", () => {
  it("starts accepting answers via the API", async () => {
    const state = { quizId: "q1", isAccepting: true, acceptStartedAtMs: 1000 };
    const api = createFakeApi({ startAcceptingAnswers: vi.fn().mockResolvedValue(state) });
    const repo = new AnswerSessionRepository(api);

    await expect(repo.start("q1")).resolves.toEqual(state);
    expect(api.startAcceptingAnswers).toHaveBeenCalledWith({ quizId: "q1" });
  });

  it("stops accepting answers via the API", async () => {
    const state = { quizId: "q1", isAccepting: false, acceptStartedAtMs: 1000 };
    const api = createFakeApi({ stopAcceptingAnswers: vi.fn().mockResolvedValue(state) });
    const repo = new AnswerSessionRepository(api);

    await expect(repo.stop("q1")).resolves.toEqual(state);
    expect(api.stopAcceptingAnswers).toHaveBeenCalledWith({ quizId: "q1" });
  });

  it("gets the acceptance state via the API", async () => {
    const state = { quizId: "q1", isAccepting: true, acceptStartedAtMs: 1000 };
    const api = createFakeApi({ getAcceptanceState: vi.fn().mockResolvedValue(state) });
    const repo = new AnswerSessionRepository(api);

    await expect(repo.getState("q1")).resolves.toEqual(state);
    expect(api.getAcceptanceState).toHaveBeenCalledWith({ quizId: "q1" });
  });

  it("submits an answer via the API", async () => {
    const answer = { userId: "u1", displayName: "太郎", optionNo: 2, serverTimestampMs: 1234 };
    const api = createFakeApi({ submitAnswer: vi.fn().mockResolvedValue(answer) });
    const repo = new AnswerSessionRepository(api);

    await expect(repo.submit("q1", "tok-1", 2)).resolves.toEqual(answer);
    expect(api.submitAnswer).toHaveBeenCalledWith({ quizId: "q1", token: "tok-1", optionNo: 2 });
  });

  it("gets submitted answers via the API", async () => {
    const answers = [{ userId: "u1", displayName: "太郎", optionNo: 2, serverTimestampMs: 1234 }];
    const api = createFakeApi({ getAnswers: vi.fn().mockResolvedValue(answers) });
    const repo = new AnswerSessionRepository(api);

    await expect(repo.getAnswers("q1")).resolves.toEqual(answers);
    expect(api.getAnswers).toHaveBeenCalledWith({ quizId: "q1" });
  });
});
