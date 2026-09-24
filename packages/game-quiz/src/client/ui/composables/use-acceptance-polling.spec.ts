import { describe, it, expect, vi, afterEach } from "vitest";
import { useAcceptancePolling } from "./use-acceptance-polling";

describe("useAcceptancePolling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches the acceptance state immediately when started", async () => {
    const acceptanceState = {
      quizId: "q1",
      isAccepting: true,
      acceptStartedAtMs: 1000,
      options: [],
    };
    const execute = vi.fn().mockResolvedValue(acceptanceState);
    const { state, start, stop } = useAcceptancePolling("q1", { useCase: { execute } });

    start();
    await Promise.resolve();
    await Promise.resolve();

    expect(execute).toHaveBeenCalledWith("q1");
    expect(state.value).toEqual(acceptanceState);
    stop();
  });

  it("swallows a poll failure without throwing and leaves state unset", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("network error"));
    const { state, start, stop } = useAcceptancePolling("q1", { useCase: { execute } });

    start();
    await Promise.resolve();
    await Promise.resolve();

    expect(state.value).toBeNull();
    stop();
  });

  it("does nothing until started", () => {
    const execute = vi.fn();
    const { state, isActive } = useAcceptancePolling("q1", { useCase: { execute } });

    expect(execute).not.toHaveBeenCalled();
    expect(state.value).toBeNull();
    expect(isActive.value).toBe(false);
  });
});
