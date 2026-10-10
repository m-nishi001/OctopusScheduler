import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { addMember } from "@octopus/accounts/server-use-cases";
import { loginParticipant } from "../participant-auth-use-cases";
import { submitAnswer } from "../answer-submission-use-cases";
import { startAcceptingAnswers } from "../answer-session-use-cases";
import {
  assertJoinToken,
  getOptionImage,
  getParticipantState,
  issueJoinToken,
} from "../join-session-use-cases";

function sequence(...tokens: string[]) {
  let i = 0;
  return () => tokens[i++] ?? `extra-${i}`;
}

function stubGenerateId(): string {
  throw new Error("generateId should not be called in these tests");
}

async function setup(storage: InMemoryKeyValueStorage) {
  await addMember({ storage, generateId: stubGenerateId }, { id: "u1", name: "太郎" });
  await loginParticipant({ storage, generateId: stubGenerateId, generateToken: () => "dev-1" }, { userId: "u1" });
  await startAcceptingAnswers(
    { storage, now: () => 1 },
    { quizId: "q1", scope: "live", options: [{ no: 1, text: "a", color: "#000", hasImage: false }] }
  );
}

describe("join-session-use-cases", () => {
  it("reuses the current token unless rotate is requested", async () => {
    const storage = new InMemoryKeyValueStorage();
    const generateToken = sequence("t1", "t2");
    const base = { quizId: "q1", scope: "live" as const };

    expect(await issueJoinToken({ storage, generateToken }, { ...base, rotate: false })).toEqual({ joinToken: "t1" });
    expect(await issueJoinToken({ storage, generateToken }, { ...base, rotate: false })).toEqual({ joinToken: "t1" });
    expect(await issueJoinToken({ storage, generateToken }, { ...base, rotate: true })).toEqual({ joinToken: "t2" });
  });

  it("invalidates the previous token when rotated", async () => {
    const storage = new InMemoryKeyValueStorage();
    const generateToken = sequence("t1", "t2");
    const base = { quizId: "q1", scope: "live" as const };
    await issueJoinToken({ storage, generateToken }, { ...base, rotate: true });
    await issueJoinToken({ storage, generateToken }, { ...base, rotate: true });

    await expect(assertJoinToken(storage, { ...base, joinToken: "t1" })).rejects.toThrow("no longer valid");
    await expect(assertJoinToken(storage, { ...base, joinToken: "t2" })).resolves.toBeUndefined();
  });

  it("keeps live and demo tokens independent", async () => {
    const storage = new InMemoryKeyValueStorage();
    const generateToken = sequence("live-t", "demo-t");
    await issueJoinToken({ storage, generateToken }, { quizId: "q1", scope: "live", rotate: true });
    await issueJoinToken({ storage, generateToken }, { quizId: "q1", scope: "demo", rotate: true });

    await expect(assertJoinToken(storage, { quizId: "q1", scope: "live", joinToken: "live-t" })).resolves.toBeUndefined();
    await expect(assertJoinToken(storage, { quizId: "q1", scope: "live", joinToken: "demo-t" })).rejects.toThrow();
  });

  it("rejects an empty token when none has been issued", async () => {
    const storage = new InMemoryKeyValueStorage();
    await expect(assertJoinToken(storage, { quizId: "q1", scope: "live", joinToken: "" })).rejects.toThrow();
  });

  it("returns my own answer so the choice survives a reload", async () => {
    const storage = new InMemoryKeyValueStorage();
    await setup(storage);
    const { joinToken } = await issueJoinToken({ storage, generateToken: () => "jt" }, { quizId: "q1", scope: "live", rotate: true });
    const deps = { storage, generateId: stubGenerateId, now: () => 5 };
    const args = { quizId: "q1", scope: "live" as const, joinToken, token: "dev-1" };

    expect((await getParticipantState(deps, args)).myAnswerNo).toBeNull();
    await submitAnswer(deps, { quizId: "q1", scope: "live", token: "dev-1", optionNo: 1 });
    const state = await getParticipantState(deps, args);

    expect(state.myAnswerNo).toBe(1);
    expect(state.acceptance.isAccepting).toBe(true);
    expect(JSON.stringify(state)).not.toContain("correctNo");
  });

  it("rejects participant state with a stale join token", async () => {
    const storage = new InMemoryKeyValueStorage();
    await issueJoinToken({ storage, generateToken: () => "jt" }, { quizId: "q1", scope: "live", rotate: true });

    await expect(
      getParticipantState(
        { storage, generateId: stubGenerateId, now: () => 1 },
        { quizId: "q1", scope: "live", joinToken: "stale" }
      )
    ).rejects.toThrow("no longer valid");
  });

  it("rejects an image request with an invalid token before touching the drive", async () => {
    const storage = new InMemoryKeyValueStorage();
    await expect(
      getOptionImage(
        { storage, cache: undefined as never },
        { quizId: "q1", scope: "live", joinToken: "bad", optionIndex: 0 }
      )
    ).rejects.toThrow("no longer valid");
  });

  it("rejects a negative option index", async () => {
    const storage = new InMemoryKeyValueStorage();
    await issueJoinToken({ storage, generateToken: () => "jt" }, { quizId: "q1", scope: "live", rotate: true });
    await expect(
      getOptionImage(
        { storage, cache: undefined as never },
        { quizId: "q1", scope: "live", joinToken: "jt", optionIndex: -1 }
      )
    ).rejects.toThrow("Invalid option index");
  });
});
