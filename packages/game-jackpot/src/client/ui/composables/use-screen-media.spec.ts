import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { FakeSoundBackend } from "@octopus/client-common/audio/fake-sound-backend";
import { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { SOUND_KEY } from "@octopus/composables/use-sound";
import { useScreenAssetUrls, useScreenMedia } from "./use-screen-media";
import type { MediaDeps } from "./use-screen-media";

/**
 * 画面の素材（BGM・画像）の読み込みと後始末。BGM は音の中心(SoundSystem)の screen チャンネルで流す。
 * 以前は画面ごとに同じ処理を書いており、読み込み中に画面を離れても、読み込みが終わってから BGM が鳴り続けたり、
 * 作った URL が破棄されなかったりしていた。
 */

/** 解放するまで返らないアセット取得を作れる、偽の依存。 */
function makeDeps(options: { settings?: unknown; blobs?: Record<string, Blob | null>; hold?: boolean; failFor?: string[] } = {}) {
  const blobs = options.blobs ?? {};
  const created: string[] = [];
  const revoked: string[] = [];
  const releases: Array<() => void> = [];
  const deps: MediaDeps = {
    fetchSetting: async () => options.settings ?? null,
    blobOf: async (id) => {
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
  };
  const backend = new FakeSoundBackend();
  const sound = new SoundSystem(backend);
  return { deps, created, revoked, backend, sound, releaseAll: () => releases.splice(0).forEach((r) => r()) };
}

/** コンポーネントの中でフックを動かす（onMounted / 破棄時の後始末が働く）。 */
function mountWith<T>(setup: () => T, sound: SoundSystem = new SoundSystem(new FakeSoundBackend())) {
  let result!: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    })
  );
  app.provide(SOUND_KEY, sound);
  app.mount(document.createElement("div"));
  return { result, unmount: () => app.unmount() };
}

const blob = (text: string) => new Blob([text]);
const flush = async () => {
  for (let i = 0; i < 50; i++) await Promise.resolve();
};

describe("useScreenAssetUrls", () => {
  it("image・se を持つ項目に表示・再生用の URL を付ける。読めないものがあっても残りは続ける", async () => {
    const env = makeDeps({ blobs: { a: blob("1"), c: blob("333") }, failFor: ["bad"] });
    const { result: urls } = mountWith(() => useScreenAssetUrls(env.deps));
    const contents: Array<{ image?: string; se?: string; imageUrl?: string; seUrl?: string }> = [{ image: "a" }, { image: "bad" }, { image: "none" }, {}, { image: "c" }];
    await urls.attach(contents);

    expect(contents[0].imageUrl).toBe("blob:0:1");
    expect(contents[1].imageUrl).toBeUndefined();
    expect(contents[2].imageUrl).toBeUndefined();
    expect(contents[3].imageUrl).toBeUndefined();
    expect(contents[4].imageUrl).toBe("blob:1:3");
  });

  it("画面を離れると、作った URL をすべて破棄する", async () => {
    const env = makeDeps({ blobs: { a: blob("1"), b: blob("22") } });
    const mounted = mountWith(() => useScreenAssetUrls(env.deps));
    await mounted.result.attach([{ image: "a" }, { image: "b" }]);
    expect(env.revoked).toEqual([]);

    mounted.unmount();
    expect(env.revoked.sort()).toEqual([...env.created].sort());
  });

  it("読み込み中に画面を離れたら、続きは読まず、新しい URL を作らない", async () => {
    const env = makeDeps({ blobs: { a: blob("1"), b: blob("22") }, hold: true });
    const mounted = mountWith(() => useScreenAssetUrls(env.deps));
    const attaching = mounted.result.attach([{ image: "a" }, { image: "b" }]);
    mounted.unmount();
    env.releaseAll();
    await attaching;

    expect(env.created).toHaveLength(0);
  });
});

describe("useScreenMedia", () => {
  type Cfg = { bgm: string; items: Array<{ image?: string; se?: string; imageUrl?: string; seUrl?: string }> };
  const options = {
    screenName: "opening",
    settingName: "opening-screen-settings",
    parse: (raw: unknown): Cfg => ({ bgm: (raw as Cfg | null)?.bgm ?? "", items: (raw as Cfg | null)?.items ?? [] }),
    items: (c: Cfg) => c.items,
  };

  it("設定・BGM・画像の準備ができてから config を出し、BGM を鳴らす（画面が出た時点で画像が揃っている）", async () => {
    const env = makeDeps({
      settings: { bgm: "bgm1", items: [{ image: "img1", se: "se1" }, { kind: "テキスト" }] },
      blobs: { bgm1: blob("abc"), img1: blob("xy"), se1: blob("s") },
    });
    const { result: media } = mountWith(() => useScreenMedia(options, env.deps), env.sound);
    expect(media.config.value).toBeNull(); // 準備中
    await flush();

    expect(media.config.value?.items[0].imageUrl).toBe("blob:0:2");
    expect(media.config.value?.items[0].seUrl).toBe("blob:1:1");
    expect(env.sound.screen.state.tracks).toMatchObject([{ key: "bgm1", status: "playing", loop: true }]);
  });

  it("設定がまだ保存されていなければ、既定の設定で出す", async () => {
    const env = makeDeps({ settings: null });
    const { result: media } = mountWith(() => useScreenMedia(options, env.deps), env.sound);
    await flush();
    expect(media.config.value).toEqual({ bgm: "", items: [] });
    expect(env.sound.screen.state.tracks).toEqual([]);
  });

  it("設定を読めなくても、既定の設定で出す（『読み込み中』のまま固まらない）", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const env = makeDeps();
    env.deps.fetchSetting = async () => {
      throw new Error("db down");
    };
    const { result: media } = mountWith(() => useScreenMedia(options, env.deps), env.sound);
    await flush();
    expect(media.config.value).toEqual({ bgm: "", items: [] });
    vi.restoreAllMocks();
  });

  it("準備中に画面を離れたら、config も BGM も出さず、作った URL を破棄する", async () => {
    const env = makeDeps({
      settings: { bgm: "bgm1", items: [{ image: "img1" }] },
      blobs: { bgm1: blob("abc"), img1: blob("xy") },
      hold: true,
    });
    const mounted = mountWith(() => useScreenMedia(options, env.deps), env.sound);
    await flush();
    mounted.unmount();
    env.releaseAll();
    await flush();
    env.releaseAll();
    await flush();

    expect(mounted.result.config.value).toBeNull();
    expect(env.sound.screen.state.tracks).toEqual([]);
    expect(env.revoked.sort()).toEqual([...env.created].sort());
  });

  it("画面を離れても BGM は止めない(止めるのは画面が切り替わるときの router の guard)が、URL は破棄する", async () => {
    const env = makeDeps({
      settings: { bgm: "bgm1", items: [{ image: "img1" }] },
      blobs: { bgm1: blob("abc"), img1: blob("xy") },
    });
    const mounted = mountWith(() => useScreenMedia(options, env.deps), env.sound);
    await flush();
    mounted.unmount();
    expect(env.sound.screen.state.tracks).toHaveLength(1);
    expect(env.revoked.sort()).toEqual([...env.created].sort());
  });
  it("同じ曲が鳴っている画面へ移っても、鳴らし直さない(流し続ける)。bgmDelayMs の待ちは、新しく鳴らすときだけ", async () => {
    vi.useFakeTimers();
    const env = makeDeps({ settings: { bgm: "same", items: [] }, blobs: { same: blob("abc") } });
    const first = mountWith(() => useScreenMedia(options, env.deps), env.sound);
    await vi.advanceTimersByTimeAsync(10);
    const id = env.backend.playingIds[0];
    first.unmount();
    mountWith(() => useScreenMedia({ ...options, bgmDelayMs: 500 }, env.deps), env.sound);
    await vi.advanceTimersByTimeAsync(1000);
    expect(env.backend.playingIds).toEqual([id]);
    expect(env.backend.calls.filter((c) => c.startsWith("play:"))).toHaveLength(1);
    vi.useRealTimers();
  });

  it("bgmDelayMs の間は鳴らさず、過ぎたら鳴らす", async () => {
    vi.useFakeTimers();
    const env = makeDeps({ settings: { bgm: "bgm1", items: [] }, blobs: { bgm1: blob("abc") } });
    mountWith(() => useScreenMedia({ ...options, bgmDelayMs: 500 }, env.deps), env.sound);
    await vi.advanceTimersByTimeAsync(499);
    expect(env.backend.playingIds).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(env.backend.playingIds).toHaveLength(1);
    vi.useRealTimers();
  });

  it("BGM の素材が無くても、画面は出す(鳴らさない)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const env = makeDeps({ settings: { bgm: "missing", items: [] }, blobs: {} });
    const { result: media } = mountWith(() => useScreenMedia(options, env.deps), env.sound);
    await flush();
    expect(media.config.value).toEqual({ bgm: "missing", items: [] });
    expect(env.backend.playingIds).toEqual([]);
    vi.restoreAllMocks();
  });
});
