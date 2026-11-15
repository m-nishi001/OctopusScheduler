import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fadeStartDelayMs, playWinningBgm, WINNING_BGM_FADE_MS } from "./bgm";
import { RouletteBgmManager } from "./roulette/roulette-bgm-manager";

describe("fadeStartDelayMs", () => {
  it("停止秒からフェードの長さを引いた時間(負にはならない)", () => {
    expect(fadeStartDelayMs(5, 1500)).toBe(3500);
    expect(fadeStartDelayMs(1, 1500)).toBe(0);
    expect(fadeStartDelayMs(0, 1500)).toBe(0);
  });
});

describe("playWinningBgm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(RouletteBgmManager, "playMedia").mockResolvedValue(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("再生を待たず、停止秒から逆算した時刻にフェードを始める(リールが止まる瞬間に無音)", async () => {
    const fade = vi.spyOn(RouletteBgmManager, "fadeOut").mockResolvedValue(undefined);
    await playWinningBgm("win.mp3", 5, { loadBgmBlob: async () => null });
    expect(RouletteBgmManager.playMedia).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000 - WINNING_BGM_FADE_MS - 1);
    expect(fade).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fade).toHaveBeenCalledWith(WINNING_BGM_FADE_MS);
  });

  it("停止秒がフェードより短いときは、すぐ始めて停止秒の長さで消す", async () => {
    const fade = vi.spyOn(RouletteBgmManager, "fadeOut").mockResolvedValue(undefined);
    await playWinningBgm("win.mp3", 1, { loadBgmBlob: async () => null });
    vi.advanceTimersByTime(0);
    expect(fade).toHaveBeenCalledWith(1000);
  });
});
