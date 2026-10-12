import { describe, it, expect } from "vitest";
import type { RankingAnswer as SubmittedAnswer } from "./ranking";
import { buildQuizRoundResult, computeRanking } from "./ranking";

function answer(overrides: Partial<SubmittedAnswer>): SubmittedAnswer {
  return {
    userId: "u1",
    displayName: "太郎",
    optionNo: 1,
    serverTimestampMs: 1000,
    ...overrides,
  };
}

describe("computeRanking", () => {
  it("excludes answers submitted before acceptStartedAtMs (出題前回答バグの修正)", () => {
    const answers: SubmittedAnswer[] = [
      answer({ userId: "early", serverTimestampMs: 500 }),
      answer({ userId: "onTime", serverTimestampMs: 2000 }),
    ];

    const result = computeRanking(answers, {
      correctNo: 1,
      acceptStartedAtMs: 1000,
      limit: 2,
    });

    const userIds = result.filter((r) => r.isCorrect).map((r) => r.userId);
    expect(userIds).toEqual(["onTime"]);
  });

  it("includes an answer submitted exactly at acceptStartedAtMs", () => {
    const answers: SubmittedAnswer[] = [answer({ userId: "u1", serverTimestampMs: 1000 })];

    const result = computeRanking(answers, {
      correctNo: 1,
      acceptStartedAtMs: 1000,
      limit: 1,
    });

    expect(result[0]).toEqual({
      userId: "u1",
      displayName: "太郎",
      isCorrect: true,
      timeToAnswerSec: 0,
    });
  });

  it("excludes answers with the wrong optionNo", () => {
    const answers: SubmittedAnswer[] = [
      answer({ userId: "wrong", optionNo: 2, serverTimestampMs: 2000 }),
    ];

    const result = computeRanking(answers, {
      correctNo: 1,
      acceptStartedAtMs: 1000,
      limit: 1,
    });

    expect(result[0].isCorrect).toBe(false);
  });

  it("sorts correct answers by server timestamp ascending", () => {
    const answers: SubmittedAnswer[] = [
      answer({ userId: "second", serverTimestampMs: 3000 }),
      answer({ userId: "first", serverTimestampMs: 2000 }),
    ];

    const result = computeRanking(answers, {
      correctNo: 1,
      acceptStartedAtMs: 1000,
      limit: 2,
    });

    expect(result.map((r) => r.userId)).toEqual(["first", "second"]);
  });

  it("computes timeToAnswerSec relative to acceptStartedAtMs", () => {
    const answers: SubmittedAnswer[] = [answer({ serverTimestampMs: 4500 })];

    const result = computeRanking(answers, {
      correctNo: 1,
      acceptStartedAtMs: 1500,
      limit: 1,
    });

    expect(result[0].timeToAnswerSec).toBeCloseTo(3, 5);
  });

  it("pads the result with placeholders up to the limit", () => {
    const result = computeRanking([], { correctNo: 1, acceptStartedAtMs: 1000, limit: 3 });

    expect(result).toHaveLength(3);
    expect(result.every((r) => !r.isCorrect && r.displayName === "正答者なし ---")).toBe(true);
  });

  it("does not filter by time when acceptStartedAtMs is null", () => {
    const answers: SubmittedAnswer[] = [answer({ serverTimestampMs: 1 })];

    const result = computeRanking(answers, { correctNo: 1, acceptStartedAtMs: null, limit: 1 });

    expect(result[0]).toEqual({
      userId: "u1",
      displayName: "太郎",
      isCorrect: true,
      timeToAnswerSec: null,
    });
  });
});

describe("buildQuizRoundResult", () => {
  const base = { roundKey: "q1:live", quizId: "q1", title: "第1問", correctNo: 2, closedAtMs: 9999 };

  it("正解者は全員を早い順に(10人を超えても)、不正解はIDだけを残す", () => {
    const answers: SubmittedAnswer[] = [
      answer({ userId: "m3", memberId: "m3", displayName: "三郎", optionNo: 2, serverTimestampMs: 4000 }),
      answer({ userId: "m1", memberId: "m1", displayName: "太郎", optionNo: 2, serverTimestampMs: 2500 }),
      answer({ userId: "m2", memberId: "m2", displayName: "花子", optionNo: 1, serverTimestampMs: 3000 }),
    ];
    const r = buildQuizRoundResult({ ...base, answers, openedAtMs: 1000, closedAtMs: 9999 });
    expect(r.correct).toEqual([
      { memberId: "m1", name: "太郎", sec: 1.5 },
      { memberId: "m3", name: "三郎", sec: 3 },
    ]);
    expect(r.wrongMemberIds).toEqual(["m2"]);
    expect(r.answeredCount).toBe(3);
    expect(r.closedAtMs).toBe(9999);

    const many = Array.from({ length: 25 }, (_, i) => answer({ userId: `u${i}`, memberId: `u${i}`, optionNo: 2, serverTimestampMs: 2000 + i }));
    expect(buildQuizRoundResult({ ...base, answers: many, openedAtMs: 1000 }).correct).toHaveLength(25);
  });

  it("出題前に届いた回答は数えない。端末IDだけの回答者は累計の対象外(memberId なし)", () => {
    const answers: SubmittedAnswer[] = [
      answer({ userId: "early", memberId: "early", optionNo: 2, serverTimestampMs: 500 }),
      answer({ userId: "dev-1", memberId: null, displayName: "ゲスト", optionNo: 2, serverTimestampMs: 2000 }),
      answer({ userId: "dev-2", optionNo: 1, serverTimestampMs: 2100 }),
    ];
    const r = buildQuizRoundResult({ ...base, answers, openedAtMs: 1000 });
    expect(r.answeredCount).toBe(2);
    expect(r.correct).toEqual([{ memberId: null, name: "ゲスト", sec: 1 }]);
    expect(r.wrongMemberIds).toEqual([]);
  });

  it("回答なしでも作れる", () => {
    const r = buildQuizRoundResult({ ...base, answers: [], openedAtMs: null });
    expect(r).toMatchObject({ answeredCount: 0, correct: [], wrongMemberIds: [] });
  });
});
