import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { JackpotRepository } from "@model/jackpot-repository";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";

const audio = vi.hoisted(() => ({ load: vi.fn(), play: vi.fn(), stop: vi.fn(), fadeOut: vi.fn() }));
vi.mock("@octopus/composables/use-audio", () => ({ useAudio: () => audio }));

import { LOTTERY_BGM_FADE_MS, LOTTERY_BGM_START_WAIT_MS, pickLotteryBgm, useLotteryBgm } from "./use-lottery-bgm";

describe("pickLotteryBgm(0〜3件から1つを選ぶ)", () => {
  it("0件・未設定・空の名前だけなら null(無音)", () => {
    expect(pickLotteryBgm([])).toBeNull();
    expect(pickLotteryBgm(undefined)).toBeNull();
    expect(pickLotteryBgm(["", "  ", null])).toBeNull();
  });

  it("1件ならそれ。複数なら乱数で1つ選び、空の名前は候補にしない", () => {
    expect(pickLotteryBgm(["a.mp3"])).toBe("a.mp3");
    const names = ["a.mp3", "", "b.mp3", "c.mp3"];
    expect([0, 0.34, 0.67, 0.999].map((r) => pickLotteryBgm(names, () => r))).toEqual(["a.mp3", "b.mp3", "c.mp3", "c.mp3"]);
  });
});

describe("useLotteryBgm", () => {
  const settings = vi.fn();
  const blobOf = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    audio.play.mockReset();
    container.clearInstances();
    container.registerInstance(ScreenSettingsService, { fetchScreenSetting: settings } as unknown as ScreenSettingsService);
    container.registerInstance(JackpotRepository, { blobOf } as unknown as JackpotRepository);
  });

  it("設定した中から1曲を読み込み、ループで流す", async () => {
    settings.mockResolvedValue({ prizeLotteryBgms: ["only.mp3"], memberLotteryBgms: ["m.mp3"] });
    const blob = new Blob(["x"]);
    blobOf.mockResolvedValue(blob);

    useLotteryBgm("prizeLotteryBgms").playRandom();
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalled());

    expect(blobOf).toHaveBeenCalledWith("only.mp3");
    expect(audio.load).toHaveBeenCalledWith(blob);
    expect(audio.play).toHaveBeenCalledWith({ isRepeat: true });
  });

  it("未設定(0件)なら何もしない。エラーにもしない", async () => {
    settings.mockResolvedValue({ prizeLotteryBgms: [] });
    const bgm = useLotteryBgm("prizeLotteryBgms");
    bgm.playRandom();
    await bgm.fadeOut();
    settings.mockResolvedValue(null);
    bgm.playRandom();
    await bgm.fadeOut();
    expect(audio.load).not.toHaveBeenCalled();
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("読み込みに失敗しても演出を止めない", async () => {
    settings.mockResolvedValue({ prizeLotteryBgms: ["a.mp3"] });
    blobOf.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bgm = useLotteryBgm("prizeLotteryBgms");
    bgm.playRandom();
    await expect(bgm.fadeOut()).resolves.toBeUndefined();
  });

  it("fadeOut は 1.5秒のフェードアウトを頼む。流していない(未設定)ときは何もしない", async () => {
    settings.mockResolvedValue({ memberLotteryBgms: ["m.mp3"] });
    blobOf.mockResolvedValue(new Blob(["x"]));
    const bgm = useLotteryBgm("memberLotteryBgms");
    await bgm.fadeOut();
    expect(audio.fadeOut).not.toHaveBeenCalled();

    bgm.playRandom();
    await bgm.fadeOut();
    expect(audio.fadeOut).toHaveBeenCalledWith(LOTTERY_BGM_FADE_MS);
    expect(LOTTERY_BGM_FADE_MS).toBe(1500);
    await bgm.fadeOut();
    expect(audio.fadeOut).toHaveBeenCalledTimes(1);
  });

  it("play() が終わらなくても(自動再生が止められるなど)、フェードアウトは先へ進み、終わる", async () => {
    settings.mockResolvedValue({ prizeLotteryBgms: ["a.mp3"] });
    blobOf.mockResolvedValue(new Blob(["x"]));
    audio.play.mockReturnValue(new Promise<void>(() => {}));
    const bgm = useLotteryBgm("prizeLotteryBgms");
    bgm.playRandom(); // 待たなくてよい(例外も出ない)
    await bgm.fadeOut();
    expect(audio.fadeOut).toHaveBeenCalledWith(LOTTERY_BGM_FADE_MS);
  });

  it("再生の準備(素材の読み込み)が終わらなくても、フェードアウトは待ちきれずに取りやめ、あとから鳴り出さない", async () => {
    vi.useFakeTimers();
    try {
      settings.mockResolvedValue({ prizeLotteryBgms: ["a.mp3"] });
      let release: (b: Blob) => void = () => {};
      blobOf.mockReturnValue(new Promise<Blob>((resolve) => (release = resolve)));
      const bgm = useLotteryBgm("prizeLotteryBgms");
      bgm.playRandom();
      const fading = bgm.fadeOut();
      await vi.advanceTimersByTimeAsync(LOTTERY_BGM_START_WAIT_MS + 100);
      await fading;
      release(new Blob(["x"]));
      await vi.advanceTimersByTimeAsync(100);
      expect(audio.fadeOut).not.toHaveBeenCalled();
      expect(audio.play).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
