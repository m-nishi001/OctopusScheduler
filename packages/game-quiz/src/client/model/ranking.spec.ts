import { describe, it, expect } from "vitest";
import type { SubmittedAnswer } from "../../server/quiz-api-contract";
import { computeRanking } from "./ranking";

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
