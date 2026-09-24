import { describe, it, expect, vi, afterEach } from 'vitest';
import { useRankingReveal } from './use-ranking-reveal';

const TIMING = {
  otherPlacesIntervalMs: 50,
  beforeTopPauseMs: 50,
  topPlaceIntervalMs: 50,
  celebrationDurationMs: 50,
};

describe('useRankingReveal', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals results bottom-up (4th+ first, then 3rd→1st), celebrating only on 1st, then finishes', async () => {
    vi.useFakeTimers();
    const results = ['a', 'b', 'c', 'd', 'e']; // a=1st .. e=5th
    const { displayedResults, showCelebration, isFinished, reveal } = useRankingReveal(TIMING);

    const done = reveal(results);

    // Synchronously, before any timer fires, the lowest non-top-3 place is
    // already shown (unshift happens before the first await).
    expect(displayedResults.value).toEqual(['e']);

    await vi.advanceTimersByTimeAsync(50); // 4th place shown
    expect(displayedResults.value).toEqual(['d', 'e']);

    await vi.advanceTimersByTimeAsync(50); // "others" loop ends, beforeTopPause wait starts
    expect(displayedResults.value).toEqual(['d', 'e']);

    await vi.advanceTimersByTimeAsync(50); // 3rd place shown
    expect(displayedResults.value).toEqual(['c', 'd', 'e']);

    await vi.advanceTimersByTimeAsync(50); // 2nd place shown
    expect(displayedResults.value).toEqual(['b', 'c', 'd', 'e']);

    await vi.advanceTimersByTimeAsync(50); // 1st place shown, celebration not yet triggered
    expect(displayedResults.value).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(showCelebration.value).toBe(false);
    expect(isFinished.value).toBe(false);

    await vi.advanceTimersByTimeAsync(50); // celebration starts
    expect(showCelebration.value).toBe(true);
    expect(isFinished.value).toBe(false);

    await vi.advanceTimersByTimeAsync(50); // celebration ends, reveal() resolves
    await done;
    expect(showCelebration.value).toBe(false);
    expect(isFinished.value).toBe(true);
  });

  it('still waits out the beforeTopPause window and finishes when there are no results', async () => {
    vi.useFakeTimers();
    const { isFinished, showCelebration, reveal } = useRankingReveal(TIMING);

    const done = reveal([]);
    await vi.runAllTimersAsync();
    await done;

    expect(isFinished.value).toBe(true);
    expect(showCelebration.value).toBe(false);
  });

  it('resets state synchronously on a subsequent reveal() call', async () => {
    vi.useFakeTimers();
    const { displayedResults, isFinished, reveal } = useRankingReveal(TIMING);

    const first = reveal(['only']);
    await vi.runAllTimersAsync();
    await first;
    expect(isFinished.value).toBe(true);

    const second = reveal(['a', 'b']);
    // Immediately after calling reveal() again, state resets before any awaits resolve.
    expect(isFinished.value).toBe(false);

    await vi.runAllTimersAsync();
    await second;
    expect(displayedResults.value).toEqual(['a', 'b']);
  });
});
