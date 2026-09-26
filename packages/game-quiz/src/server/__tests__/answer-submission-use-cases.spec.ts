import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { addMember } from "@octopus/member-directory/server-use-cases";
import { loginParticipant } from "../participant-auth-use-cases";
import { getAnswers, submitAnswer } from "../answer-submission-use-cases";

function stubClock(times: number[]) {
  let i = 0;
  return () => times[i++] ?? times[times.length - 1] ?? 0;
}

function stubGenerateId(): string {
  throw new Error("generateId should not be called in these tests");
}

let participantSeq = 0;

async function setupParticipant(storage: InMemoryKeyValueStorage, userId: string, displayName: string) {
  await addMember({ storage, generateId: stubGenerateId }, { id: userId, name: displayName });
  const token = `tok-${userId}-${participantSeq++}`;
  await loginParticipant(
    { storage, generateId: stubGenerateId, generateToken: () => token },
    { userId }
  );
  return token;
}

describe("answer-submission-use-cases", () => {
  it("returns an empty list when no answers have been submitted", async () => {
    const storage = new InMemoryKeyValueStorage();
    expect(
      await getAnswers({ storage, generateId: stubGenerateId, now: stubClock([]) }, { quizId: "q1" })
    ).toEqual([]);
  });

  it("records a submitted answer with the server-side timestamp", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    const now = stubClock([1234]);

    const answer = await submitAnswer(
      { storage, generateId: stubGenerateId, now },
      { quizId: "q1", token, optionNo: 2 }
    );

    expect(answer).toEqual({
      userId: "u1",
      displayName: "太郎",
      optionNo: 2,
      serverTimestampMs: 1234,
    });
    expect(
      await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q1" })
    ).toEqual([answer]);
  });

  it("rejects a submission with an invalid device token", async () => {
    const storage = new InMemoryKeyValueStorage();
    await expect(
      submitAnswer(
        { storage, generateId: stubGenerateId, now: stubClock([1000]) },
        { quizId: "q1", token: "bogus", optionNo: 1 }
      )
    ).rejects.toThrow();
  });

  it("ignores a second submission from the same participant and keeps the first", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    const now = stubClock([1000, 9999]);

    const first = await submitAnswer(
      { storage, generateId: stubGenerateId, now },
      { quizId: "q1", token, optionNo: 1 }
    );
    const second = await submitAnswer(
      { storage, generateId: stubGenerateId, now },
      { quizId: "q1", token, optionNo: 3 }
    );

    expect(second).toEqual(first);
    expect(
      await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q1" })
    ).toEqual([first]);
  });

  it("keeps answers to different quizzes independent", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    const now = stubClock([1000, 2000]);

    await submitAnswer({ storage, generateId: stubGenerateId, now }, { quizId: "q1", token, optionNo: 1 });
    await submitAnswer({ storage, generateId: stubGenerateId, now }, { quizId: "q2", token, optionNo: 2 });

    expect(
      await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q1" })
    ).toHaveLength(1);
    expect(
      await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q2" })
    ).toHaveLength(1);
  });

  it("records answers from multiple participants for the same quiz", async () => {
    const storage = new InMemoryKeyValueStorage();
    const tokenA = await setupParticipant(storage, "u1", "太郎");
    const tokenB = await setupParticipant(storage, "u2", "次郎");
    const now = stubClock([1000, 1500]);

    await submitAnswer(
      { storage, generateId: stubGenerateId, now },
      { quizId: "q1", token: tokenA, optionNo: 1 }
    );
    await submitAnswer(
      { storage, generateId: stubGenerateId, now },
      { quizId: "q1", token: tokenB, optionNo: 2 }
    );

    const answers = await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q1" });
    expect(answers.map((a) => a.userId).sort()).toEqual(["u1", "u2"]);
  });
});
