import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { JackpotRepository } from "@model/jackpot-repository";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";

import { FakeSoundBackend } from "@octopus/client-common/audio/fake-sound-backend";
import { SoundSystem } from "@octopus/client-common/audio/sound-system";

// useLotteryBgm は、音の中心(SoundSystem)の screen チャンネルで鳴らす。偽の音の部品で、鳴っているか・どう止めたかを見る
const sound = vi.hoisted(() => ({ system: null as unknown as SoundSystem }));
vi.mock("@octopus/composables/use-sound", () => ({ useSound: () => sound.system }));

import { LOTTERY_BGM_FADE_MS, LOTTERY_BGM_START_WAIT_MS, pickLotteryBgm, shouldHoldLotteryBgm, useLotteryBgm } from "./use-lottery-bgm";

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

describe("shouldHoldLotteryBgm(結果BGMが空なら、抽選BGMを止まるまで流す)", () => {
  it("未設定・0件・空の名前だけなら true", () => {
    expect(shouldHoldLotteryBgm(undefined)).toBe(true);
    expect(shouldHoldLotteryBgm(null)).toBe(true);
    expect(shouldHoldLotteryBgm([])).toBe(true);
    expect(shouldHoldLotteryBgm(["", "  "])).toBe(true);
    expect(shouldHoldLotteryBgm("")).toBe(true);
  });

  it("1曲でもあれば false(文字列でも配列でも)", () => {
    expect(shouldHoldLotteryBgm("a.mp3")).toBe(false);
    expect(shouldHoldLotteryBgm(["", "a.mp3"])).toBe(false);
  });
});

describe("useLotteryBgm", () => {
  const settings = vi.fn();
  const blobOf = vi.fn();
  let backend: FakeSoundBackend;
  const tracks = () => sound.system.screen.state.tracks;
  beforeEach(() => {
    vi.clearAllMocks();
    backend = new FakeSoundBackend();
    sound.system = new SoundSystem(backend);
    container.clearInstances();
    container.registerInstance(ScreenSettingsService, { fetchScreenSetting: settings } as unknown as ScreenSettingsService);
    container.registerInstance(JackpotRepository, { blobOf } as unknown as JackpotRepository);
  });

  it("設定した中から1曲を読み込み、1回だけ流す(ループ指定はしない)", async () => {
    settings.mockResolvedValue({ prizeLotteryBgms: ["only.mp3"], memberLotteryBgms: ["m.mp3"] });
    blobOf.mockResolvedValue(new Blob(["x"]));

    useLotteryBgm("prizeLotteryBgms").playRandom();
    await vi.waitFor(() => expect(tracks()).toMatchObject([{ key: "only.mp3", status: "playing", loop: false }]));
    expect(blobOf).toHaveBeenCalledWith("only.mp3");
  });

  it("メンバー結果BGMのキーでも、その欄から1曲を選ぶ", async () => {
    settings.mockResolvedValue({ memberResultBgms: ["r.mp3"], memberLotteryBgms: ["m.mp3"] });
    blobOf.mockResolvedValue(new Blob(["x"]));
    useLotteryBgm("memberResultBgms").playRandom();
    await vi.waitFor(() => expect(tracks()).toMatchObject([{ key: "r.mp3" }]));
    expect(blobOf).toHaveBeenCalledWith("r.mp3");
  });

  it("未設定(0件)なら何もしない。エラーにもしない", async () => {
    settings.mockResolvedValue({ prizeLotteryBgms: [] });
    const bgm = useLotteryBgm("prizeLotteryBgms");
    bgm.playRandom();
    await bgm.fadeOut();
    settings.mockResolvedValue(null);
    bgm.playRandom();
    await bgm.fadeOut();
    expect(tracks()).toEqual([]);
    expect(backend.calls).toEqual([]);
  });

  it("読み込みに失敗しても演出を止めない", async () => {
    settings.mockResolvedValue({ prizeLotteryBgms: ["a.mp3"] });
    blobOf.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bgm = useLotteryBgm("prizeLotteryBgms");
    bgm.playRandom();
    await expect(bgm.fadeOut()).resolves.toBeUndefined();
    expect(tracks()).toEqual([]);
  });

  it("fadeOut は 1.5秒のフェードアウトで止める。流していない(未設定)ときは何もしない。2回目は何もしない", async () => {
    settings.mockResolvedValue({ memberLotteryBgms: ["m.mp3"] });
    blobOf.mockResolvedValue(new Blob(["x"]));
    const bgm = useLotteryBgm("memberLotteryBgms");
    await bgm.fadeOut();
    expect(backend.calls).toEqual([]);

    bgm.playRandom();
    await vi.waitFor(() => expect(tracks()).toHaveLength(1));
    const id = backend.playingIds[0];
    await bgm.fadeOut();
    expect(backend.calls).toContain(`stop:${id}:fade=${LOTTERY_BGM_FADE_MS}`);
    expect(LOTTERY_BGM_FADE_MS).toBe(1500);
    expect(tracks()).toEqual([]);
    await bgm.fadeOut();
    expect(backend.calls.filter((c) => c.startsWith("stop:"))).toHaveLength(1);
  });

  it("stop はすぐ止める(フェードしない)", async () => {
    settings.mockResolvedValue({ memberResultBgms: ["r.mp3"] });
    blobOf.mockResolvedValue(new Blob(["x"]));
    const bgm = useLotteryBgm("memberResultBgms");
    bgm.playRandom();
    await vi.waitFor(() => expect(tracks()).toHaveLength(1));
    const id = backend.playingIds[0];
    await bgm.stop();
    expect(backend.calls).toContain(`stop:${id}:fade=0`);
    expect(tracks()).toEqual([]);
  });

  it("同じ曲がまだ鳴っていれば、止めて頭から鳴らし直す", async () => {
    settings.mockResolvedValue({ prizeLotteryBgms: ["a.mp3"] });
    blobOf.mockResolvedValue(new Blob(["x"]));
    const bgm = useLotteryBgm("prizeLotteryBgms");
    bgm.playRandom();
    await vi.waitFor(() => expect(tracks()).toHaveLength(1));
    const first = backend.playingIds[0];
    bgm.playRandom();
    await vi.waitFor(() => expect(backend.playingIds[0]).not.toBe(first));
    expect(backend.playingIds).toHaveLength(1);
    expect(tracks()).toHaveLength(1);
  });

  it("2つの抽選BGM(メンバーと景品)は、同じ screen チャンネルで、あとから鳴らす方が前の曲を置き換える", async () => {
    settings.mockResolvedValue({ memberLotteryBgms: ["m.mp3"], prizeLotteryBgms: ["p.mp3"] });
    blobOf.mockResolvedValue(new Blob(["x"]));
    useLotteryBgm("memberLotteryBgms").playRandom();
    await vi.waitFor(() => expect(tracks()).toMatchObject([{ key: "m.mp3" }]));
    useLotteryBgm("prizeLotteryBgms").playRandom();
    await vi.waitFor(() => expect(tracks()).toMatchObject([{ key: "p.mp3" }]));
    expect(backend.playingIds).toHaveLength(1);
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
      expect(tracks()).toEqual([]);
      expect(backend.calls).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("音の読み込み(デコード)が終わらなくても、フェードアウトは先へ進み、取りやめる。あとから鳴り出さない", async () => {
    vi.useFakeTimers();
    try {
      settings.mockResolvedValue({ prizeLotteryBgms: ["a.mp3"] });
      blobOf.mockResolvedValue(new Blob(["x"]));
      let release: () => void = () => {};
      backend.holdLoad = new Promise<void>((resolve) => (release = resolve));
      const bgm = useLotteryBgm("prizeLotteryBgms");
      bgm.playRandom();
      const fading = bgm.fadeOut();
      await vi.advanceTimersByTimeAsync(LOTTERY_BGM_START_WAIT_MS + 100);
      await fading;
      expect(tracks()).toEqual([]);
      release();
      await vi.advanceTimersByTimeAsync(100);
      expect(backend.playingIds).toEqual([]);
      expect(backend.alive).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
