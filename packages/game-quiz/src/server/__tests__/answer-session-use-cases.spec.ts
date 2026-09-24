import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import {
  getAcceptanceState,
  startAcceptingAnswers,
  stopAcceptingAnswers,
} from "../answer-session-use-cases";

function stubClock(times: number[]) {
  let i = 0;
  return () => times[i++] ?? times[times.length - 1] ?? 0;
}

describe("answer-session-use-cases", () => {
  it("reports not accepting before any session has started", () => {
    const storage = new InMemoryKeyValueStorage();
    const state = getAcceptanceState({ storage, now: stubClock([]) }, { quizId: "q1" });
    expect(state).toEqual({ quizId: "q1", isAccepting: false, acceptStartedAtMs: null });
  });

  it("starts accepting answers and records the start time", () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000]);

    const started = startAcceptingAnswers({ storage, now }, { quizId: "q1" });

    expect(started).toEqual({ quizId: "q1", isAccepting: true, acceptStartedAtMs: 1000 });
    expect(getAcceptanceState({ storage, now }, { quizId: "q1" })).toEqual(started);
  });

  it("stops accepting answers but keeps the original start time", () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000, 5000]);
    startAcceptingAnswers({ storage, now }, { quizId: "q1" });

    const stopped = stopAcceptingAnswers({ storage, now }, { quizId: "q1" });

    expect(stopped).toEqual({ quizId: "q1", isAccepting: false, acceptStartedAtMs: 1000 });
  });

  it("stopping a session that never started leaves acceptStartedAtMs null", () => {
    const storage = new InMemoryKeyValueStorage();
    const stopped = stopAcceptingAnswers(
      { storage, now: stubClock([]) },
      { quizId: "q1" }
    );
    expect(stopped).toEqual({ quizId: "q1", isAccepting: false, acceptStartedAtMs: null });
  });

  it("keeps separate acceptance state per quizId", () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000, 2000]);
    startAcceptingAnswers({ storage, now }, { quizId: "q1" });
    startAcceptingAnswers({ storage, now }, { quizId: "q2" });

    expect(getAcceptanceState({ storage, now }, { quizId: "q1" }).acceptStartedAtMs).toBe(1000);
    expect(getAcceptanceState({ storage, now }, { quizId: "q2" }).acceptStartedAtMs).toBe(2000);
  });

  it("restarting a session overwrites the previous start time", () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000, 9000]);
    startAcceptingAnswers({ storage, now }, { quizId: "q1" });
    stopAcceptingAnswers({ storage, now: stubClock([]) }, { quizId: "q1" });

    const restarted = startAcceptingAnswers({ storage, now }, { quizId: "q1" });

    expect(restarted).toEqual({ quizId: "q1", isAccepting: true, acceptStartedAtMs: 9000 });
  });
});
