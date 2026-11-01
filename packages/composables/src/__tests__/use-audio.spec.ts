import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudio } from "../use-audio";

/** jsdom には再生機能が無いので、<audio> の代わりになる偽物。 */
class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  loop = false;
  muted = false;
  volume = 1;
  currentTime = 0;
  paused = true;
  /** 次の play() を拒否する回数（自動再生が止められる状況）。mutedで鳴らすときは通す。 */
  static blockUnmutedPlay = false;
  src: string;
  constructor(src: string) {
    super();
    this.src = src;
    FakeAudio.instances.push(this);
  }
  async play() {
    if (FakeAudio.blockUnmutedPlay && !this.muted) throw new Error("NotAllowedError");
    this.paused = false;
    this.dispatchEvent(new Event("playing"));
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
}

let created: string[];
let revoked: string[];

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.blockUnmutedPlay = false;
  created = [];
  revoked = [];
  vi.stubGlobal("Audio", FakeAudio);
  URL.createObjectURL = (() => {
    const url = `blob:test/${created.length}`;
    created.push(url);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((url: string) => void revoked.push(url)) as typeof URL.revokeObjectURL;
});
afterEach(() => vi.unstubAllGlobals());

const blob = () => new Blob(["x"], { type: "audio/mpeg" });

describe("useAudio", () => {
  it("読み込んで再生でき、繰り返し再生にできる。止めると先頭に戻る", async () => {
    const audio = useAudio();
    await audio.load(blob());
    expect(audio.isPlaying.value).toBe(false);

    await audio.play({ isRepeat: true });
    expect(audio.isPlaying.value).toBe(true);
    expect(FakeAudio.instances[0].loop).toBe(true);

    FakeAudio.instances[0].currentTime = 12;
    await audio.stop();
    expect(audio.isPlaying.value).toBe(false);
    expect(FakeAudio.instances[0].currentTime).toBe(0);
  });

  it("曲を読み込む前の再生・停止は何もしない（落ちない）", async () => {
    const audio = useAudio();
    await expect(audio.play()).resolves.toBeUndefined();
    await expect(audio.stop()).resolves.toBeUndefined();
    expect(audio.tryResume.length).toBe(0);
    expect(await audio.tryResume()).toBe(false);
  });

  it("別の曲を読み込むと、前の曲を止めて、前の Blob の URL を破棄する（同時に鳴らない）", async () => {
    const audio = useAudio();
    await audio.load(blob());
    await audio.play();
    await audio.load(blob());

    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(revoked).toEqual(["blob:test/0"]);
    expect(audio.isPlaying.value).toBe(false);
    expect(audio.currentSrc.value).toBe("blob:test/1");
  });

  it("文字列の URL はそのまま使い、破棄しない", async () => {
    const audio = useAudio();
    await audio.load("https://example.test/a.mp3");
    await audio.load("https://example.test/b.mp3");
    expect(created).toEqual([]);
    expect(revoked).toEqual([]);
  });

  it("音量は 0〜1 に収め、次に読み込む曲にも引き継ぐ", async () => {
    const audio = useAudio();
    audio.setVolume(5);
    expect(audio.volume.value).toBe(1);
    audio.setVolume(0.3);
    await audio.load(blob());
    expect(FakeAudio.instances[0].volume).toBe(0.3);
    audio.setVolume(-1);
    expect(FakeAudio.instances[0].volume).toBe(0);
  });

  describe("自動再生が止められたとき", () => {
    it("音を出さずに再生を始め（autoplayBlocked）、利用者の操作で tryResume すると音が出る", async () => {
      FakeAudio.blockUnmutedPlay = true;
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const audio = useAudio();
      await audio.load(blob());
      await audio.play();

      expect(audio.autoplayBlocked.value).toBe(true);
      expect(FakeAudio.instances[0].muted).toBe(true);
      expect(audio.isPlaying.value).toBe(true);

      FakeAudio.blockUnmutedPlay = false; // 利用者の操作のあとは、ブラウザが許す
      expect(await audio.tryResume()).toBe(true);
      expect(FakeAudio.instances[0].muted).toBe(false);
      expect(audio.autoplayBlocked.value).toBe(false);
      vi.restoreAllMocks();
    });

    it("止められていないときの tryResume は何もしない", async () => {
      const audio = useAudio();
      await audio.load(blob());
      await audio.play();
      expect(await audio.tryResume()).toBe(false);
    });
  });
});
