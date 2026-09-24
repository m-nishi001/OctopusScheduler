import { describe, it, expect, vi } from "vitest";
import type { ParticipantAuthRepository } from "../../model/participant-auth-repository";
import type { AnswerSessionRepository } from "../../model/answer-session-repository";
import { LoginParticipantUseCase } from "./login-participant-use-case";
import { ResolveDeviceTokenUseCase } from "./resolve-device-token-use-case";
import { StartAcceptingAnswersUseCase } from "./start-accepting-answers-use-case";
import { StopAcceptingAnswersUseCase } from "./stop-accepting-answers-use-case";
import { GetAcceptanceStateUseCase } from "./get-acceptance-state-use-case";
import { SubmitAnswerUseCase } from "./submit-answer-use-case";
import { GetSubmittedAnswersUseCase } from "./get-submitted-answers-use-case";

function createFakeAuthRepository(
  overrides: Partial<ParticipantAuthRepository> = {}
): ParticipantAuthRepository {
  return { login: vi.fn(), resolveToken: vi.fn(), ...overrides } as unknown as ParticipantAuthRepository;
}

function createFakeAnswerSessionRepository(
  overrides: Partial<AnswerSessionRepository> = {}
): AnswerSessionRepository {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    getState: vi.fn(),
    submit: vi.fn(),
    getAnswers: vi.fn(),
    ...overrides,
  } as unknown as AnswerSessionRepository;
}

describe("answer flow use-cases", () => {
  it("LoginParticipantUseCase delegates to the repository", async () => {
    const session = { token: "tok-1", userId: "u1", displayName: "太郎" };
    const repository = createFakeAuthRepository({ login: vi.fn().mockResolvedValue(session) });

    await expect(new LoginParticipantUseCase(repository).execute("u1")).resolves.toEqual(session);
    expect(repository.login).toHaveBeenCalledWith("u1");
  });

  it("ResolveDeviceTokenUseCase delegates to the repository", async () => {
    const session = { token: "tok-1", userId: "u1", displayName: "太郎" };
    const repository = createFakeAuthRepository({
      resolveToken: vi.fn().mockResolvedValue(session),
    });

    await expect(new ResolveDeviceTokenUseCase(repository).execute("tok-1")).resolves.toEqual(
      session
    );
    expect(repository.resolveToken).toHaveBeenCalledWith("tok-1");
  });

  it("StartAcceptingAnswersUseCase delegates to the repository", async () => {
    const state = { quizId: "q1", isAccepting: true, acceptStartedAtMs: 1000 };
    const repository = createFakeAnswerSessionRepository({
      start: vi.fn().mockResolvedValue(state),
    });

    await expect(new StartAcceptingAnswersUseCase(repository).execute("q1")).resolves.toEqual(
      state
    );
    expect(repository.start).toHaveBeenCalledWith("q1");
  });

  it("StopAcceptingAnswersUseCase delegates to the repository", async () => {
    const state = { quizId: "q1", isAccepting: false, acceptStartedAtMs: 1000 };
    const repository = createFakeAnswerSessionRepository({ stop: vi.fn().mockResolvedValue(state) });

    await expect(new StopAcceptingAnswersUseCase(repository).execute("q1")).resolves.toEqual(
      state
    );
    expect(repository.stop).toHaveBeenCalledWith("q1");
  });

  it("GetAcceptanceStateUseCase delegates to the repository", async () => {
    const state = { quizId: "q1", isAccepting: true, acceptStartedAtMs: 1000 };
    const repository = createFakeAnswerSessionRepository({
      getState: vi.fn().mockResolvedValue(state),
    });

    await expect(new GetAcceptanceStateUseCase(repository).execute("q1")).resolves.toEqual(state);
    expect(repository.getState).toHaveBeenCalledWith("q1");
  });

  it("SubmitAnswerUseCase delegates to the repository", async () => {
    const answer = { userId: "u1", displayName: "太郎", optionNo: 2, serverTimestampMs: 1234 };
    const repository = createFakeAnswerSessionRepository({
      submit: vi.fn().mockResolvedValue(answer),
    });

    await expect(
      new SubmitAnswerUseCase(repository).execute("q1", "tok-1", 2)
    ).resolves.toEqual(answer);
    expect(repository.submit).toHaveBeenCalledWith("q1", "tok-1", 2);
  });

  it("GetSubmittedAnswersUseCase delegates to the repository", async () => {
    const answers = [{ userId: "u1", displayName: "太郎", optionNo: 2, serverTimestampMs: 1234 }];
    const repository = createFakeAnswerSessionRepository({
      getAnswers: vi.fn().mockResolvedValue(answers),
    });

    await expect(new GetSubmittedAnswersUseCase(repository).execute("q1")).resolves.toEqual(
      answers
    );
    expect(repository.getAnswers).toHaveBeenCalledWith("q1");
  });
});
