import { describe, it, expect, vi, afterEach } from 'vitest';
import { useAnswerWindow } from './use-answer-window';

function createDeps(remainingMs = 3000) {
  return {
    gateway: {
      open: vi.fn().mockResolvedValue({ key: 'q1:live', deadlineMs: 1_000_000 + remainingMs, remainingMs }),
      close: vi.fn().mockResolvedValue(undefined),
    },
  };
}

const OPTIONS = [
  { no: 1, text: 'A' },
  { no: 2, text: 'B' },
];

describe('useAnswerWindow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the answer round and counts down using the server-provided remaining time', async () => {
    vi.useFakeTimers();
    const deps = createDeps(3000);
    const onOpened = vi.fn();
    const { timeLeft, showModal, start } = useAnswerWindow(deps);

    await start({ quizId: 'q1', timeLimit: 10, options: OPTIONS, scope: 'live', onOpened });

    expect(deps.gateway.open).toHaveBeenCalledWith('q1', 'live', OPTIONS, 10);
    // the visible timer follows the server deadline, not the nominal time limit
    expect(timeLeft.value).toBe(3);
    expect(onOpened).toHaveBeenCalledWith(expect.objectContaining({ key: 'q1:live', deadlineMs: 1_003_000 }));

    await vi.advanceTimersByTimeAsync(1000);
    expect(timeLeft.value).toBe(2);
    expect(showModal.value).toBe(false);
  });

  it('a host reload mid-question resumes with the remaining time, not the full time limit', async () => {
    vi.useFakeTimers();
    const deps = createDeps(4200);
    const { timeLeft, start } = useAnswerWindow(deps);
    await start({ quizId: 'q1', timeLimit: 20, options: OPTIONS, scope: 'live' });
    expect(timeLeft.value).toBe(5); // ceil(4.2s)
  });

  it('finishes automatically when the timer reaches zero and closes the round', async () => {
    vi.useFakeTimers();
    const deps = createDeps(1000);
    const onFinish = vi.fn();
    const { timeLeft, showModal, canProceed, start } = useAnswerWindow(deps);

    await start({ quizId: 'q1', timeLimit: 1, options: OPTIONS, scope: 'live', onFinish });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);

    expect(timeLeft.value).toBe(0);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(deps.gateway.close).toHaveBeenCalledWith('q1', 'live');
    expect(showModal.value).toBe(true);
    expect(canProceed.value).toBe(true);
  });

  it('opens and closes the round on the given session scope (demo runs the real flow)', async () => {
    vi.useFakeTimers();
    const deps = createDeps(1000);
    const { start } = useAnswerWindow(deps);

    await start({ quizId: 'q1', timeLimit: 1, options: OPTIONS, scope: 'demo' });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);

    expect(deps.gateway.open).toHaveBeenCalledWith('q1', 'demo', OPTIONS, 1);
    expect(deps.gateway.close).toHaveBeenCalledWith('q1', 'demo');
  });

  it('works without a session (the host is not connected): plain countdown using the time limit', async () => {
    vi.useFakeTimers();
    const deps = { gateway: { open: vi.fn().mockResolvedValue(null), close: vi.fn().mockResolvedValue(undefined) } };
    const onOpened = vi.fn();
    const { timeLeft, start } = useAnswerWindow(deps);
    await start({ quizId: 'q1', timeLimit: 7, options: OPTIONS, scope: 'live', onOpened });
    expect(timeLeft.value).toBe(7);
    expect(onOpened).not.toHaveBeenCalled();
  });

  it('emergencyStop() finishes immediately and prevents the timer from also finishing', async () => {
    vi.useFakeTimers();
    const deps = createDeps(10_000);
    const onFinish = vi.fn();
    const { timeLeft, showModal, emergencyStop, start } = useAnswerWindow(deps);

    await start({ quizId: 'q1', timeLimit: 10, options: OPTIONS, scope: 'live', onFinish });
    emergencyStop();
    await vi.advanceTimersByTimeAsync(0);

    expect(showModal.value).toBe(true);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(deps.gateway.close).toHaveBeenCalledTimes(1);

    // The interval should have been cleared, so further time passing must not
    // trigger a second finish() or further countdown.
    await vi.advanceTimersByTimeAsync(15000);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(timeLeft.value).toBe(10);
  });

  it('calling emergencyStop() twice, or racing the timer, closes the round only once', async () => {
    vi.useFakeTimers();
    const deps = createDeps(1000);
    const { emergencyStop, start } = useAnswerWindow(deps);
    await start({ quizId: 'q1', timeLimit: 1, options: OPTIONS, scope: 'live' });
    emergencyStop();
    emergencyStop();
    await vi.advanceTimersByTimeAsync(2000);
    expect(deps.gateway.close).toHaveBeenCalledTimes(1);
  });

  it('a failure to open the round does not stop the visible countdown, and shows a warning', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = { gateway: { open: vi.fn().mockRejectedValue(new Error('network error')), close: vi.fn().mockResolvedValue(undefined) } };
    const { timeLeft, errorMessage, start } = useAnswerWindow(deps);
    await start({ quizId: 'q1', timeLimit: 3, options: OPTIONS, scope: 'live' });
    expect(errorMessage.value).toContain('開始できませんでした');
    await vi.advanceTimersByTimeAsync(1000);
    expect(timeLeft.value).toBe(2);
  });

  it('a failure to close the round still lets the operator proceed (the server closes at the deadline anyway)', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps = createDeps(1000);
    deps.gateway.close.mockRejectedValue(new Error('network error'));
    const { canProceed, errorMessage, isLoading, start } = useAnswerWindow(deps);
    await start({ quizId: 'q1', timeLimit: 1, options: OPTIONS, scope: 'live' });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(isLoading.value).toBe(false);
    expect(canProceed.value).toBe(true);
    expect(errorMessage.value).toContain('自動で終了');
  });
});
