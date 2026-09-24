import { describe, it, expect, vi, afterEach } from 'vitest';
import { useAnswerWindow } from './use-answer-window';

function createDeps() {
  return {
    startAcceptingAnswersUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
    stopAcceptingAnswersUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
  };
}

describe('useAnswerWindow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts accepting answers and counts down the timer', async () => {
    vi.useFakeTimers();
    const deps = createDeps();
    const { timeLeft, showModal, start } = useAnswerWindow(deps);

    await start({ quizId: 'q1', timeLimit: 3, options: [], isPreview: false });

    expect(deps.startAcceptingAnswersUseCase.execute).toHaveBeenCalledWith('q1', []);
    expect(timeLeft.value).toBe(3);

    await vi.advanceTimersByTimeAsync(1000);
    expect(timeLeft.value).toBe(2);
    expect(showModal.value).toBe(false);
  });

  it('finishes automatically when the timer reaches zero and stops accepting answers', async () => {
    vi.useFakeTimers();
    const deps = createDeps();
    const onFinish = vi.fn();
    const { timeLeft, showModal, canProceed, start } = useAnswerWindow(deps);

    await start({ quizId: 'q1', timeLimit: 1, options: [], isPreview: false, onFinish });
    await vi.advanceTimersByTimeAsync(1000);
    // allow the async finish() to resolve
    await vi.advanceTimersByTimeAsync(0);

    expect(timeLeft.value).toBe(0);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(deps.stopAcceptingAnswersUseCase.execute).toHaveBeenCalledWith('q1');
    expect(showModal.value).toBe(true);
    expect(canProceed.value).toBe(true);
  });

  it('does not touch server acceptance state in preview mode', async () => {
    vi.useFakeTimers();
    const deps = createDeps();
    const { start } = useAnswerWindow(deps);

    await start({ quizId: 'q1', timeLimit: 1, options: [], isPreview: true });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);

    expect(deps.startAcceptingAnswersUseCase.execute).not.toHaveBeenCalled();
    expect(deps.stopAcceptingAnswersUseCase.execute).not.toHaveBeenCalled();
  });

  it('emergencyStop() finishes immediately and prevents the timer from also finishing', async () => {
    vi.useFakeTimers();
    const deps = createDeps();
    const onFinish = vi.fn();
    const { timeLeft, showModal, emergencyStop, start } = useAnswerWindow(deps);

    await start({ quizId: 'q1', timeLimit: 10, options: [], isPreview: false, onFinish });
    emergencyStop();
    await vi.advanceTimersByTimeAsync(0);

    expect(showModal.value).toBe(true);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(deps.stopAcceptingAnswersUseCase.execute).toHaveBeenCalledTimes(1);

    // The interval should have been cleared, so further time passing must not
    // trigger a second finish() or further countdown.
    await vi.advanceTimersByTimeAsync(15000);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(timeLeft.value).toBe(10);
  });

  it('emergencyStop() is a no-op once already stopping', async () => {
    vi.useFakeTimers();
    const deps = createDeps();
    const { emergencyStop, start } = useAnswerWindow(deps);

    await start({ quizId: 'q1', timeLimit: 10, options: [], isPreview: false });
    emergencyStop();
    emergencyStop();
    await vi.advanceTimersByTimeAsync(0);

    expect(deps.stopAcceptingAnswersUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('surfaces an error but still allows proceeding when stopping fails', async () => {
    vi.useFakeTimers();
    const deps = createDeps();
    deps.stopAcceptingAnswersUseCase.execute.mockRejectedValue(new Error('network error'));
    const { errorMessage, canProceed, isLoading, emergencyStop, start } = useAnswerWindow(deps);

    await start({ quizId: 'q1', timeLimit: 10, options: [], isPreview: false });
    emergencyStop();
    await vi.advanceTimersByTimeAsync(0);

    expect(errorMessage.value).toBe('受付終了処理に失敗しました。');
    expect(canProceed.value).toBe(true);
    expect(isLoading.value).toBe(false);
  });
});
