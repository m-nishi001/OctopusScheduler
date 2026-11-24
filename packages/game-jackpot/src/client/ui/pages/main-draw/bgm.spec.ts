import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSoundBackend } from "@octopus/client-common/audio/fake-sound-backend";
import { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { fadeStartDelayMs, playWinningBgm, preloadBgm, WINNING_BGM_FADE_MS } from "./bgm";

describe("fadeStartDelayMs", () => {
  it("停止秒からフェードの長さを引いた時間(負にはならない)", () => {
    expect(fadeStartDelayMs(5, 1500)).toBe(3500);
    expect(fadeStartDelayMs(1, 1500)).toBe(0);
    expect(fadeStartDelayMs(0, 1500)).toBe(0);
  });
});

describe("当選BGM", () => {
  let backend: FakeSoundBackend;
  let sound: SoundSystem;
  const ctx = () => ({ loadBgmBlob: async () => new Blob(["x"]), sound });
  beforeEach(() => {
    vi.useFakeTimers();
    backend = new FakeSoundBackend();
    sound = new SoundSystem(backend);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("1回だけ流し(ループしない)、停止秒から逆算した時刻にフェードを始める(リールが止まる瞬間に無音)", async () => {
    await playWinningBgm("win.mp3", 5, ctx());
    expect(sound.screen.state.tracks).toMatchObject([{ key: "win.mp3", status: "playing", loop: false }]);
    const id = backend.playingIds[0];
    await vi.advanceTimersByTimeAsync(5000 - WINNING_BGM_FADE_MS - 1);
    expect(backend.calls.some((c) => c.startsWith("stop:"))).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(backend.calls).toContain(`stop:${id}:fade=${WINNING_BGM_FADE_MS}`);
  });

  it("停止秒がフェードより短いときは、すぐ始めて停止秒の長さで消す", async () => {
    await playWinningBgm("win.mp3", 1, ctx());
    const id = backend.playingIds[0];
    await vi.advanceTimersByTimeAsync(0);
    expect(backend.calls).toContain(`stop:${id}:fade=1000`);
  });

  it("曲が空なら何もしない。流れている景品抽選BGM(同じチャンネル)を、巻き込んで止めない", async () => {
    await sound.screen.play({ key: "lottery.mp3", load: async () => new Blob(["x"]) });
    await playWinningBgm("", 2, ctx());
    await playWinningBgm(null, 2, ctx());
    await vi.advanceTimersByTimeAsync(5000);
    expect(sound.screen.state.tracks).toMatchObject([{ key: "lottery.mp3", status: "playing" }]);
  });

  it("素材が読めなくても、例外にせず、演出は進む", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(playWinningBgm("missing.mp3", 3, { loadBgmBlob: async () => null, sound })).resolves.toBeUndefined();
    expect(sound.screen.state.tracks).toEqual([]);
  });

  it("preloadBgm で先に読み込んでおくと、鳴らすときは読み込み直さない", async () => {
    const load = vi.fn(async () => new Blob(["x"]));
    const deps = { loadBgmBlob: load, sound };
    await preloadBgm("win.mp3", deps);
    await playWinningBgm("win.mp3", 3, deps);
    expect(load).toHaveBeenCalledTimes(1);
    expect(backend.playingIds).toHaveLength(1);
    await preloadBgm("", deps); // 空は何もしない
  });
});
