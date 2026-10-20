import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { useScreenAssetUrls, useScreenBgm, useScreenMedia } from "./use-screen-media";
import type { MediaDeps } from "./use-screen-media";

/**
 * 画面の素材（BGM・画像）の読み込みと後始末。
 * 以前は画面ごとに同じ処理を書いており、読み込み中に画面を離れても、読み込みが終わってから BGM が鳴り続けたり、
 * 作った URL が破棄されなかったりしていた。
 */

class FakeAudio {
  loop = false;
  paused = true;
  constructor(public src: string) {}
  async play() {
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
}

/** 解放するまで返らないアセット取得を作れる、偽の依存。 */
function makeDeps(options: { settings?: unknown; blobs?: Record<string, Blob | null>; hold?: boolean; failFor?: string[] } = {}) {
  const blobs = options.blobs ?? {};
  const created: string[] = [];
  const revoked: string[] = [];
  const audios: FakeAudio[] = [];
  const releases: Array<() => void> = [];
  const deps: MediaDeps = {
    fetchSetting: async () => options.settings ?? null,
    getAssetBlob: async (id) => {
      if (options.failFor?.includes(id)) throw new Error("boom");
      if (options.hold) await new Promise<void>((resolve) => releases.push(resolve));
      return blobs[id] ?? null;
    },
    createObjectUrl: (blob) => {
      const url = `blob:${created.length}:${blob.size}`;
      created.push(url);
      return url;
    },
    revokeObjectUrl: (url) => void revoked.push(url),
    createAudio: (url) => {
      const audio = new FakeAudio(url);
      audios.push(audio);
      return audio as unknown as HTMLAudioElement;
    },
  };
  return { deps, created, revoked, audios, releaseAll: () => releases.splice(0).forEach((r) => r()) };
}

/** コンポーネントの中でフックを動かす（onMounted / 破棄時の後始末が働く）。 */
function mountWith<T>(setup: () => T) {
  let result!: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    })
  );
  app.mount(document.createElement("div"));
  return { result, unmount: () => app.unmount() };
}

const blob = (text: string) => new Blob([text]);
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("useScreenBgm", () => {
  it("アセットから BGM を作り、ループ再生に設定して、再生できる", async () => {
    const env = makeDeps({ blobs: { bgm1: blob("abc") } });
    const { result: bgm } = mountWith(() => useScreenBgm(env.deps));
    await bgm.load("bgm1");

    expect(bgm.bgm.value).not.toBeNull();
    expect(env.audios[0].loop).toBe(true);
    expect(env.audios[0].paused).toBe(true); // 読み込んだだけでは鳴らさない
    bgm.play();
    expect(env.audios[0].paused).toBe(false);
  });

  it("id が空・アセットが無い・読み込みに失敗したときは、何も作らず、画面は進められる", async () => {
    const env = makeDeps({ blobs: {}, failFor: ["bad"] });
    const { result: bgm } = mountWith(() => useScreenBgm(env.deps));
    await bgm.load("");
    await bgm.load(undefined);
    await bgm.load("missing");
    await bgm.load("bad");
    expect(bgm.bgm.value).toBeNull();
    expect(() => bgm.play()).not.toThrow();
  });

  it("再生まで待ちを指定でき、待つ間に画面を離れたら鳴らさない", async () => {
    vi.useFakeTimers();
    const env = makeDeps({ blobs: { bgm1: blob("abc") } });
    const mounted = mountWith(() => useScreenBgm(env.deps));
    await mounted.result.load("bgm1");
    mounted.result.play(500);
    await vi.advanceTimersByTimeAsync(499);
    expect(env.audios[0].paused).toBe(true);

    mounted.unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(env.audios[0].paused).toBe(true);
    vi.useRealTimers();
  });

  it("画面を離れると、止めて URL を破棄する", async () => {
    const env = makeDeps({ blobs: { bgm1: blob("abc") } });
    const mounted = mountWith(() => useScreenBgm(env.deps));
    await mounted.result.load("bgm1");
    mounted.result.play();

    mounted.unmount();
    expect(env.audios[0].paused).toBe(true);
    expect(env.revoked).toEqual(env.created);
    expect(mounted.result.bgm.value).toBeNull();
  });

  it("読み込み中に画面を離れたら、読み込みが終わっても BGM を作らない（離れたあとに鳴り続けない）", async () => {
    const env = makeDeps({ blobs: { bgm1: blob("abc") }, hold: true });
    const mounted = mountWith(() => useScreenBgm(env.deps));
    const loading = mounted.result.load("bgm1");
    mounted.unmount();
    env.releaseAll();
    await loading;

    expect(env.audios).toHaveLength(0);
    expect(env.created).toHaveLength(0);
  });
});

describe("useScreenAssetUrls", () => {
  it("assetId を持つコンテンツに表示用の URL を付ける。読めないものがあっても残りは続ける", async () => {
    const env = makeDeps({ blobs: { a: blob("1"), c: blob("333") }, failFor: ["bad"] });
    const { result: urls } = mountWith(() => useScreenAssetUrls(env.deps));
    const contents: Array<{ assetId?: string; assetUrl?: string }> = [{ assetId: "a" }, { assetId: "bad" }, { assetId: "none" }, {}, { assetId: "c" }];
    await urls.attach(contents);

    expect(contents[0].assetUrl).toBe("blob:0:1");
    expect(contents[1].assetUrl).toBeUndefined();
    expect(contents[2].assetUrl).toBeUndefined();
    expect(contents[3].assetUrl).toBeUndefined();
    expect(contents[4].assetUrl).toBe("blob:1:3");
  });

  it("画面を離れると、作った URL をすべて破棄する", async () => {
    const env = makeDeps({ blobs: { a: blob("1"), b: blob("22") } });
    const mounted = mountWith(() => useScreenAssetUrls(env.deps));
    await mounted.result.attach([{ assetId: "a" }, { assetId: "b" }]);
    expect(env.revoked).toEqual([]);

    mounted.unmount();
    expect(env.revoked.sort()).toEqual([...env.created].sort());
  });

  it("読み込み中に画面を離れたら、続きは読まず、新しい URL を作らない", async () => {
    const env = makeDeps({ blobs: { a: blob("1"), b: blob("22") }, hold: true });
    const mounted = mountWith(() => useScreenAssetUrls(env.deps));
    const attaching = mounted.result.attach([{ assetId: "a" }, { assetId: "b" }]);
    mounted.unmount();
    env.releaseAll();
    await attaching;

    expect(env.created).toHaveLength(0);
  });
});

describe("useScreenMedia", () => {
  const options = { screenName: "opening", settingName: "opening-screen-settings", fallback: () => ({ bgmAssetId: "", contents: [] as Array<{ assetId?: string; assetUrl?: string }> }) };

  it("設定・BGM・画像の準備ができてから config を出し、BGM を鳴らす（画面が出た時点で画像が揃っている）", async () => {
    const env = makeDeps({
      settings: { bgmAssetId: "bgm1", contents: [{ assetId: "img1" }, { type: "text" }] },
      blobs: { bgm1: blob("abc"), img1: blob("xy") },
    });
    const { result: media } = mountWith(() => useScreenMedia(options, env.deps));
    expect(media.config.value).toBeNull(); // 準備中
    await flush();

    expect(media.config.value?.contents?.[0].assetUrl).toBe("blob:1:2");
    expect(media.bgm.value).not.toBeNull();
    expect(env.audios[0].paused).toBe(false);
  });

  it("設定がまだ保存されていなければ、既定の設定で出す", async () => {
    const env = makeDeps({ settings: null });
    const { result: media } = mountWith(() => useScreenMedia(options, env.deps));
    await flush();
    expect(media.config.value).toEqual({ bgmAssetId: "", contents: [] });
    expect(media.bgm.value).toBeNull();
  });

  it("設定を読めなくても、既定の設定で出す（『読み込み中』のまま固まらない）", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const env = makeDeps();
    env.deps.fetchSetting = async () => {
      throw new Error("db down");
    };
    const { result: media } = mountWith(() => useScreenMedia(options, env.deps));
    await flush();
    expect(media.config.value).toEqual({ bgmAssetId: "", contents: [] });
    vi.restoreAllMocks();
  });

  it("準備中に画面を離れたら、config も BGM も出さず、作った URL を破棄する", async () => {
    const env = makeDeps({
      settings: { bgmAssetId: "bgm1", contents: [{ assetId: "img1" }] },
      blobs: { bgm1: blob("abc"), img1: blob("xy") },
      hold: true,
    });
    const mounted = mountWith(() => useScreenMedia(options, env.deps));
    await flush();
    mounted.unmount();
    env.releaseAll();
    await flush();
    env.releaseAll();
    await flush();

    expect(mounted.result.config.value).toBeNull();
    expect(env.audios.every((a) => a.paused)).toBe(true);
    expect(env.revoked.sort()).toEqual([...env.created].sort());
  });

  it("画面を離れると、BGM を止めて URL を破棄する", async () => {
    const env = makeDeps({
      settings: { bgmAssetId: "bgm1", contents: [{ assetId: "img1" }] },
      blobs: { bgm1: blob("abc"), img1: blob("xy") },
    });
    const mounted = mountWith(() => useScreenMedia(options, env.deps));
    await flush();
    mounted.unmount();
    expect(env.audios[0].paused).toBe(true);
    expect(env.revoked.sort()).toEqual([...env.created].sort());
  });
});
