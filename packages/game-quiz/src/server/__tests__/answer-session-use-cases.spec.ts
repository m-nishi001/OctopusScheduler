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

const OPTIONS = [
  { no: 1, text: "赤", color: "#ef4444" },
  { no: 2, text: "青", color: "#3b82f6" },
];

describe("answer-session-use-cases", () => {
  it("reports not accepting before any session has started", async () => {
    const storage = new InMemoryKeyValueStorage();
    const state = await getAcceptanceState({ storage, now: stubClock([]) }, { quizId: "q1", scope: "live" });
    expect(state).toEqual({
      quizId: "q1",
      isAccepting: false,
      acceptStartedAtMs: null,
      options: [],
    });
  });

  it("starts accepting answers, records the start time, and stores the option metadata", async () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000]);

    const started = await startAcceptingAnswers(
      { storage, now },
      { quizId: "q1", scope: "live", options: OPTIONS }
    );

    expect(started).toEqual({
      quizId: "q1",
      isAccepting: true,
      acceptStartedAtMs: 1000,
      options: OPTIONS,
    });
    expect(await getAcceptanceState({ storage, now }, { quizId: "q1", scope: "live" })).toEqual(started);
  });

  it("stops accepting answers but keeps the original start time and options", async () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000, 5000]);
    await startAcceptingAnswers({ storage, now }, { quizId: "q1", scope: "live", options: OPTIONS });

    const stopped = await stopAcceptingAnswers({ storage, now }, { quizId: "q1", scope: "live" });

    expect(stopped).toEqual({
      quizId: "q1",
      isAccepting: false,
      acceptStartedAtMs: 1000,
      options: OPTIONS,
    });
  });

  it("stopping a session that never started leaves acceptStartedAtMs null and options empty", async () => {
    const storage = new InMemoryKeyValueStorage();
    const stopped = await stopAcceptingAnswers(
      { storage, now: stubClock([]) },
      { quizId: "q1", scope: "live" }
    );
    expect(stopped).toEqual({
      quizId: "q1",
      isAccepting: false,
      acceptStartedAtMs: null,
      options: [],
    });
  });

  it("keeps separate acceptance state per quizId", async () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000, 2000]);
    await startAcceptingAnswers({ storage, now }, { quizId: "q1", scope: "live", options: OPTIONS });
    await startAcceptingAnswers({ storage, now }, { quizId: "q2", scope: "live", options: [] });

    expect((await getAcceptanceState({ storage, now }, { quizId: "q1", scope: "live" })).acceptStartedAtMs).toBe(1000);
    expect((await getAcceptanceState({ storage, now }, { quizId: "q2", scope: "live" })).acceptStartedAtMs).toBe(2000);
  });

  it("restarting a session overwrites the previous start time and options", async () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000, 9000]);
    await startAcceptingAnswers({ storage, now }, { quizId: "q1", scope: "live", options: OPTIONS });
    await stopAcceptingAnswers({ storage, now: stubClock([]) }, { quizId: "q1", scope: "live" });

    const newOptions = [{ no: 1, text: "はい", color: "#22c55e" }];
    const restarted = await startAcceptingAnswers(
      { storage, now },
      { quizId: "q1", scope: "live", options: newOptions }
    );

    expect(restarted).toEqual({
      quizId: "q1",
      isAccepting: true,
      acceptStartedAtMs: 9000,
      options: newOptions,
    });
  });

  it("isolates demo and live sessions of the same quiz", async () => {
    const storage = new InMemoryKeyValueStorage();
    const now = stubClock([1000]);
    await startAcceptingAnswers({ storage, now }, { quizId: "q1", scope: "demo", options: OPTIONS });

    expect((await getAcceptanceState({ storage, now }, { quizId: "q1", scope: "demo" })).isAccepting).toBe(true);
    expect((await getAcceptanceState({ storage, now }, { quizId: "q1", scope: "live" })).isAccepting).toBe(false);
  });
});
