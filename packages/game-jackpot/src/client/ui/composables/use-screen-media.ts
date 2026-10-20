import { onMounted, onScopeDispose, shallowRef } from "vue";
import type { ShallowRef } from "vue";
import { container } from "tsyringe";
import { AssetDataService } from "@control/asset/asset-data-service";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";

/**
 * 画面（オープニング・エンディング・説明・デモ・結果）が使う素材（BGM・画像）の読み込みと後始末。
 *
 * どの画面も「設定を読む → アセットから音と画像のURLを作る → 再生 → 画面を離れたら止めて URL を破棄」を
 * 同じ手順で行うので、ここに集める。画面を読み込んでいる最中に離れた場合は、読み込みが終わっても
 * 音を鳴らさず、作ったURLも破棄する（離れたあとに BGM が鳴り続けないように）。
 * 必ずコンポーネントの setup() の同期実行中に呼ぶ（後始末を登録するため）。
 */

/** 素材の読み込みが依存する外部。テストで差し替える。 */
export interface MediaDeps {
  /** 画面設定を読む。無ければ null。 */
  fetchSetting(screenName: string, settingName: string): Promise<unknown | null>;
  /** アセットの中身（音声・画像）。無い・中身が無いときは null。 */
  getAssetBlob(assetId: string): Promise<Blob | null>;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
  createAudio(url: string): HTMLAudioElement;
}

function defaultMediaDeps(): MediaDeps {
  return {
    fetchSetting: (screenName, settingName) => container.resolve(ScreenSettingsService).fetchScreenSetting(screenName, settingName),
    getAssetBlob: async (assetId) => (await container.resolve(AssetDataService).getAssetDataById(assetId))?.blob ?? null,
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    createAudio: (url) => new Audio(url),
  };
}

export interface ScreenBgm {
  /** 読み込み済みの BGM。まだ・読み込めなかったときは null。 */
  bgm: ShallowRef<HTMLAudioElement | null>;
  /** アセットから BGM を読み込む（ループ再生に設定する）。`assetId` が空・読み込めないときは何もしない。再生は {@link play}。 */
  load(assetId: string | null | undefined): Promise<void>;
  /** 読み込んだ BGM を再生する（`delayMs` 後）。自動再生が拒否されても、画面は止めない。 */
  play(delayMs?: number): void;
}

/** BGM 1曲の読み込み・再生・後始末。画面を離れたら止めて、URL を破棄する。 */
export function useScreenBgm(deps: MediaDeps = defaultMediaDeps()): ScreenBgm {
  const bgm = shallowRef<HTMLAudioElement | null>(null);
  let url: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  onScopeDispose(() => {
    disposed = true;
    if (timer) clearTimeout(timer);
    bgm.value?.pause();
    bgm.value = null;
    if (url) deps.revokeObjectUrl(url);
    url = null;
  });

  async function load(assetId: string | null | undefined): Promise<void> {
    if (!assetId) return;
    let blob: Blob | null = null;
    try {
      blob = await deps.getAssetBlob(assetId);
    } catch (error) {
      console.warn("[ScreenMedia] failed to load BGM asset", assetId, error);
    }
    if (!blob || disposed) return; // 読み込み中に画面を離れていたら、音を作らない
    url = deps.createObjectUrl(blob);
    const audio = deps.createAudio(url);
    audio.loop = true;
    bgm.value = audio;
  }

  function play(delayMs = 0): void {
    const start = () => void bgm.value?.play().catch(() => undefined);
    if (delayMs <= 0) start();
    else timer = setTimeout(start, delayMs);
  }

  return { bgm, load, play };
}

/** 画像などのコンテンツ（`assetId` を持つ）に、表示用の URL（`assetUrl`）を付ける。作った URL は画面を離れたら破棄する。 */
export function useScreenAssetUrls(deps: MediaDeps = defaultMediaDeps()): {
  attach(contents: ReadonlyArray<{ assetId?: string; assetUrl?: string }>): Promise<void>;
} {
  const urls: string[] = [];
  let disposed = false;

  onScopeDispose(() => {
    disposed = true;
    for (const url of urls) deps.revokeObjectUrl(url);
    urls.length = 0;
  });

  return {
    /** 1件が読めなくても、残りは続ける（読めなかった分は `assetUrl` を付けない）。 */
    async attach(contents) {
      for (const content of contents) {
        if (!content.assetId) continue;
        try {
          const blob = await deps.getAssetBlob(content.assetId);
          if (disposed) return;
          if (blob) {
            const url = deps.createObjectUrl(blob);
            urls.push(url);
            content.assetUrl = url;
          }
        } catch (error) {
          console.warn("[ScreenMedia] failed to load asset for content", content, error);
        }
      }
    },
  };
}

export interface ScreenMediaOptions<TConfig> {
  screenName: string;
  settingName: string;
  /** 設定がまだ保存されていないときの既定の設定。 */
  fallback(): TConfig;
  /** 画面が出てから BGM を鳴らし始めるまでの待ち（ミリ秒）。 */
  bgmDelayMs?: number;
}

export interface ScreenMedia<TConfig> {
  /** 素材の準備が終わった設定。準備中は null（画面は「読み込み中」を出す）。 */
  config: ShallowRef<TConfig | null>;
  bgm: ShallowRef<HTMLAudioElement | null>;
}

/**
 * 画面設定（`bgmAssetId` と、`assetId` を持つ `contents`）を読み、BGM と画像の URL を用意して、
 * **準備ができてから** `config` を出し、BGM を鳴らす（画面が出た時点で画像が揃っている）。
 */
export function useScreenMedia<TConfig extends { bgmAssetId?: string; contents?: Array<{ assetId?: string; assetUrl?: string }> }>(
  options: ScreenMediaOptions<TConfig>,
  deps: MediaDeps = defaultMediaDeps()
): ScreenMedia<TConfig> {
  const config: ShallowRef<TConfig | null> = shallowRef(null);
  const bgm = useScreenBgm(deps);
  const assetUrls = useScreenAssetUrls(deps);
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
  });

  onMounted(async () => {
    let loaded: TConfig | null = null;
    try {
      loaded = (await deps.fetchSetting(options.screenName, options.settingName)) as TConfig | null;
    } catch (error) {
      // 設定が読めなくても、既定の設定で画面は出す（「読み込み中」のまま固まらないように）
      console.error(`[ScreenMedia] failed to load ${options.screenName} settings`, error);
    }
    loaded ??= options.fallback();
    if (disposed) return;
    await bgm.load(loaded.bgmAssetId);
    await assetUrls.attach(loaded.contents ?? []);
    if (disposed) return;
    config.value = loaded;
    bgm.play(options.bgmDelayMs);
  });

  return { config, bgm: bgm.bgm };
}
