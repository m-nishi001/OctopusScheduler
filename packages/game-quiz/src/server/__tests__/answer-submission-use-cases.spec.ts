import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { addMember } from "../member-use-cases";
import { loginParticipant } from "../participant-auth-use-cases";
import { getAnswers, submitAnswer } from "../answer-submission-use-cases";

function stubClock(times: number[]) {
  let i = 0;
  return () => times[i++] ?? times[times.length - 1] ?? 0;
}

let participantSeq = 0;

function setupParticipant(storage: InMemoryKeyValueStorage, userId: string, displayName: string) {
  addMember({ storage }, { userId, displayName });
  const token = `tok-${userId}-${participantSeq++}`;
  loginParticipant({ storage, generateToken: () => token }, { userId });
  return token;
}

describe("answer-submission-use-cases", () => {
  it("returns an empty list when no answers have been submitted", () => {
    const storage = new InMemoryKeyValueStorage();
    expect(getAnswers({ storage, now: stubClock([]) }, { quizId: "q1" })).toEqual([]);
  });

  it("records a submitted answer with the server-side timestamp", () => {
    const storage = new InMemoryKeyValueStorage();
    const token = setupParticipant(storage, "u1", "太郎");
    const now = stubClock([1234]);

    const answer = submitAnswer({ storage, now }, { quizId: "q1", token, optionNo: 2 });

    expect(answer).toEqual({
      userId: "u1",
      displayName: "太郎",
      optionNo: 2,
      serverTimestampMs: 1234,
    });
    expect(getAnswers({ storage, now }, { quizId: "q1" })).toEqual([answer]);
  });

  it("rejects a submission with an invalid device token", () => {
    const storage = new InMemoryKeyValueStorage();
    expect(() =>
      submitAnswer(
        { storage, now: stubClock([1000]) },
        { quizId: "q1", token: "bogus", optionNo: 1 }
      )
    ).toThrow();
  });

  it("ignores a second submission from the same participant and keeps the first", () => {
    const storage = new InMemoryKeyValueStorage();
    const token = setupParticipant(storage, "u1", "太郎");
    const now = stubClock([1000, 9999]);

    const first = submitAnswer({ storage, now }, { quizId: "q1", token, optionNo: 1 });
    const second = submitAnswer({ storage, now }, { quizId: "q1", token, optionNo: 3 });

    expect(second).toEqual(first);
    expect(getAnswers({ storage, now }, { quizId: "q1" })).toEqual([first]);
  });

  it("keeps answers to different quizzes independent", () => {
    const storage = new InMemoryKeyValueStorage();
    const token = setupParticipant(storage, "u1", "太郎");
    const now = stubClock([1000, 2000]);

    submitAnswer({ storage, now }, { quizId: "q1", token, optionNo: 1 });
    submitAnswer({ storage, now }, { quizId: "q2", token, optionNo: 2 });

    expect(getAnswers({ storage, now }, { quizId: "q1" })).toHaveLength(1);
    expect(getAnswers({ storage, now }, { quizId: "q2" })).toHaveLength(1);
  });

  it("records answers from multiple participants for the same quiz", () => {
    const storage = new InMemoryKeyValueStorage();
    const tokenA = setupParticipant(storage, "u1", "太郎");
    const tokenB = setupParticipant(storage, "u2", "次郎");
    const now = stubClock([1000, 1500]);

    submitAnswer({ storage, now }, { quizId: "q1", token: tokenA, optionNo: 1 });
    submitAnswer({ storage, now }, { quizId: "q1", token: tokenB, optionNo: 2 });

    const answers = getAnswers({ storage, now }, { quizId: "q1" });
    expect(answers.map((a) => a.userId).sort()).toEqual(["u1", "u2"]);
  });
});
