import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { addMember } from "@octopus/accounts/server-use-cases";
import { loginParticipant } from "../participant-auth-use-cases";
import { getAnswers, submitAnswer } from "../answer-submission-use-cases";
import { startAcceptingAnswers, stopAcceptingAnswers } from "../answer-session-use-cases";

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

async function open(storage: InMemoryKeyValueStorage, quizId: string, scope: "live" | "demo" = "live") {
  await startAcceptingAnswers({ storage, now: stubClock([1]) }, { quizId, scope, options: [] });
}

describe("answer-submission-use-cases", () => {
  it("returns an empty list when no answers have been submitted", async () => {
    const storage = new InMemoryKeyValueStorage();
    expect(
      await getAnswers({ storage, generateId: stubGenerateId, now: stubClock([]) }, { quizId: "q1", scope: "live" })
    ).toEqual([]);
  });

  it("records a submitted answer with the server-side timestamp", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    await open(storage, "q1");
    const now = stubClock([1234]);

    const answer = await submitAnswer(
      { storage, generateId: stubGenerateId, now },
      { quizId: "q1", scope: "live", token, optionNo: 2 }
    );

    expect(answer).toEqual({
      userId: "u1",
      displayName: "太郎",
      optionNo: 2,
      serverTimestampMs: 1234,
    });
    expect(
      await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q1", scope: "live" })
    ).toEqual([answer]);
  });

  it("rejects a submission with an invalid device token", async () => {
    const storage = new InMemoryKeyValueStorage();
    await open(storage, "q1");
    await expect(
      submitAnswer(
        { storage, generateId: stubGenerateId, now: stubClock([1000]) },
        { quizId: "q1", scope: "live", token: "bogus", optionNo: 1 }
      )
    ).rejects.toThrow();
  });

  it("ignores a second submission from the same participant and keeps the first", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    await open(storage, "q1");
    const now = stubClock([1000, 9999]);

    const first = await submitAnswer(
      { storage, generateId: stubGenerateId, now },
      { quizId: "q1", scope: "live", token, optionNo: 1 }
    );
    const second = await submitAnswer(
      { storage, generateId: stubGenerateId, now },
      { quizId: "q1", scope: "live", token, optionNo: 3 }
    );

    expect(second).toEqual(first);
    expect(
      await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q1", scope: "live" })
    ).toEqual([first]);
  });

  it("keeps answers to different quizzes independent", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    await open(storage, "q1");
    await open(storage, "q2");
    const now = stubClock([1000, 2000]);

    await submitAnswer({ storage, generateId: stubGenerateId, now }, { quizId: "q1", scope: "live", token, optionNo: 1 });
    await submitAnswer({ storage, generateId: stubGenerateId, now }, { quizId: "q2", scope: "live", token, optionNo: 2 });

    expect(
      await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q1", scope: "live" })
    ).toHaveLength(1);
    expect(
      await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q2", scope: "live" })
    ).toHaveLength(1);
  });

  it("records answers from multiple participants for the same quiz", async () => {
    const storage = new InMemoryKeyValueStorage();
    const tokenA = await setupParticipant(storage, "u1", "太郎");
    const tokenB = await setupParticipant(storage, "u2", "次郎");
    await open(storage, "q1");
    const now = stubClock([1000, 1500]);

    await submitAnswer(
      { storage, generateId: stubGenerateId, now },
      { quizId: "q1", scope: "live", token: tokenA, optionNo: 1 }
    );
    await submitAnswer(
      { storage, generateId: stubGenerateId, now },
      { quizId: "q1", scope: "live", token: tokenB, optionNo: 2 }
    );

    const answers = await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q1", scope: "live" });
    expect(answers.map((a) => a.userId).sort()).toEqual(["u1", "u2"]);
  });

  it("同じクイズの受付を再開始すると前回の回答が消え、同じ参加者の新しい回答が記録される(再実行)", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    const deps = (times: number[]) => ({ storage, generateId: stubGenerateId, now: stubClock(times) });
    const args = { quizId: "q1", scope: "live" as const };

    await startAcceptingAnswers({ storage, now: stubClock([1000]) }, { ...args, options: [] });
    await submitAnswer(deps([1500]), { ...args, token, optionNo: 2 });

    // 2ラウンド目(やり直し など)
    await startAcceptingAnswers({ storage, now: stubClock([5000]) }, { ...args, options: [] });
    expect(await getAnswers(deps([]), args)).toEqual([]);

    await submitAnswer(deps([5300]), { ...args, token, optionNo: 1 });
    expect(await getAnswers(deps([]), args)).toEqual([
      { userId: "u1", displayName: "太郎", optionNo: 1, serverTimestampMs: 5300 },
    ]);
  });

  it("受付の再開始は他のクイズの回答には影響しない", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    await open(storage, "q2");
    const deps = (times: number[]) => ({ storage, generateId: stubGenerateId, now: stubClock(times) });

    await submitAnswer(deps([100]), { quizId: "q2", scope: "live", token, optionNo: 1 });
    await startAcceptingAnswers({ storage, now: stubClock([5000]) }, { quizId: "q1", scope: "live", options: [] });

    expect(await getAnswers(deps([]), { quizId: "q2", scope: "live" })).toHaveLength(1);
  });

  it("keeps demo and live answers of the same quiz independent", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    await open(storage, "q1", "demo");
    await open(storage, "q1", "live");
    const now = stubClock([1000, 2000]);

    await submitAnswer({ storage, generateId: stubGenerateId, now }, { quizId: "q1", scope: "demo", token, optionNo: 1 });
    await submitAnswer({ storage, generateId: stubGenerateId, now }, { quizId: "q1", scope: "live", token, optionNo: 2 });

    const demo = await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q1", scope: "demo" });
    const live = await getAnswers({ storage, generateId: stubGenerateId, now }, { quizId: "q1", scope: "live" });
    expect(demo.map((a) => a.optionNo)).toEqual([1]);
    expect(live.map((a) => a.optionNo)).toEqual([2]);
  });

  it("デモの受付開始は本番の回答を消さない", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    await open(storage, "q1", "live");
    const deps = (times: number[]) => ({ storage, generateId: stubGenerateId, now: stubClock(times) });

    await submitAnswer(deps([100]), { quizId: "q1", scope: "live", token, optionNo: 1 });
    await startAcceptingAnswers({ storage, now: stubClock([5000]) }, { quizId: "q1", scope: "demo", options: [] });

    expect(await getAnswers(deps([]), { quizId: "q1", scope: "live" })).toHaveLength(1);
  });

  it("受付を開始していない間(開始前)の回答は拒否され、記録されない", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    const deps = { storage, generateId: stubGenerateId, now: stubClock([100]) };

    await expect(submitAnswer(deps, { quizId: "q1", scope: "live", token, optionNo: 1 })).rejects.toThrow();
    expect(await getAnswers(deps, { quizId: "q1", scope: "live" })).toEqual([]);
  });

  it("受付を停止した後の回答は拒否される", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    const deps = { storage, generateId: stubGenerateId, now: stubClock([100]) };

    await open(storage, "q1");
    await stopAcceptingAnswers({ storage, now: stubClock([200]) }, { quizId: "q1", scope: "live" });

    await expect(submitAnswer(deps, { quizId: "q1", scope: "live", token, optionNo: 1 })).rejects.toThrow();
  });

  it("デモの受付中でも本番の回答は受け付けない(scopeが独立)", async () => {
    const storage = new InMemoryKeyValueStorage();
    const token = await setupParticipant(storage, "u1", "太郎");
    const deps = { storage, generateId: stubGenerateId, now: stubClock([100]) };

    await open(storage, "q1", "demo");

    await expect(submitAnswer(deps, { quizId: "q1", scope: "live", token, optionNo: 1 })).rejects.toThrow();
    await expect(submitAnswer(deps, { quizId: "q1", scope: "demo", token, optionNo: 1 })).resolves.toBeDefined();
  });
});
