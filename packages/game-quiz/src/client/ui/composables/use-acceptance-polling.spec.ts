import { describe, it, expect, vi, afterEach } from "vitest";
import { useAcceptancePolling } from "./use-acceptance-polling";

const acceptance = { quizId: "q1", isAccepting: true, acceptStartedAtMs: 1000, options: [] };

describe("useAcceptancePolling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches the state and my answer immediately when started", async () => {
    const execute = vi.fn().mockResolvedValue({ acceptance, myAnswerNo: 2 });
    const { state, myAnswerNo, start, stop } = useAcceptancePolling("q1", "demo", "jt", () => "dev", {
      useCase: { execute },
    });

    start();
    await Promise.resolve();
    await Promise.resolve();

    expect(execute).toHaveBeenCalledWith("q1", "demo", "jt", "dev");
    expect(state.value).toEqual(acceptance);
    expect(myAnswerNo.value).toBe(2);
    stop();
  });

  it("swallows a poll failure without throwing and leaves state unset", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("network error"));
    const { state, isLinkExpired, start, stop } = useAcceptancePolling("q1", "demo", "jt", () => undefined, {
      useCase: { execute },
    });

    start();
    await Promise.resolve();
    await Promise.resolve();

    expect(state.value).toBeNull();
    expect(isLinkExpired.value).toBe(false);
    stop();
  });

  it("flags the link as expired when the join token is rejected", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("Join link is no longer valid"));
    const { isLinkExpired, start } = useAcceptancePolling("q1", "demo", "old", () => undefined, {
      useCase: { execute },
    });

    start();
    await Promise.resolve();
    await Promise.resolve();

    expect(isLinkExpired.value).toBe(true);
  });

  it("does nothing until started", () => {
    const execute = vi.fn();
    const { state, isActive } = useAcceptancePolling("q1", "demo", "jt", () => undefined, {
      useCase: { execute },
    });

    expect(execute).not.toHaveBeenCalled();
    expect(state.value).toBeNull();
    expect(isActive.value).toBe(false);
  });
});
