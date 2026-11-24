import { onMounted, onScopeDispose, shallowRef } from "vue";
import { useScreenSound } from "./use-screen-sound";
import type { ShallowRef } from "vue";
import { container } from "tsyringe";
import { JackpotRepository } from "@model/jackpot-repository";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";

/**
 * 画面（オープニング・エンディング・説明・デモ抽選・結果）が使う素材（BGM・画像・効果音）の読み込みと後始末。
 *
 * どの画面も「設定を読む → アセットから画像・効果音のURLを作る → BGM を流す → 画面を離れたら URL を破棄」を
 * 同じ手順で行うので、ここに集める。BGM は音の中心(`SoundSystem` の `screen`)で流す: 同じ曲が鳴っていれば流し続け、
 * 画面が切り替わるときに止める(screen-bgm-guard)。画面を読み込んでいる最中に離れた場合は、作ったURLを破棄する。
 * 必ずコンポーネントの setup() の同期実行中に呼ぶ（後始末を登録するため）。
 */

/** 素材の読み込みが依存する外部。テストで差し替える。 */
export interface MediaDeps {
  /** 画面設定を読む。無ければ null。 */
  fetchSetting(screenName: string, settingName: string): Promise<unknown | null>;
  /** 素材（音声・画像）の中身を名前で引く。無い・中身が無いときは null。 */
  blobOf(name: string): Promise<Blob | null>;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
}

function defaultMediaDeps(): MediaDeps {
  return {
    fetchSetting: (screenName, settingName) => container.resolve(ScreenSettingsService).fetchScreenSetting(screenName, settingName),
    blobOf: (name) => container.resolve(JackpotRepository).blobOf(name),
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  };
}

/** 素材を参照する項目(画像 `image`・効果音 `se` の名前)。再生のための URL(`imageUrl`・`seUrl`)を付ける対象。 */
export interface MediaItem {
  image?: string;
  se?: string;
  imageUrl?: string;
  seUrl?: string;
}

/** 項目の画像・効果音に、表示・再生用の URL(`imageUrl`・`seUrl`)を付ける。作った URL は画面を離れたら破棄する。 */
export function useScreenAssetUrls(deps: MediaDeps = defaultMediaDeps()): {
  attach(items: ReadonlyArray<MediaItem>): Promise<void>;
} {
  const urls: string[] = [];
  let disposed = false;

  onScopeDispose(() => {
    disposed = true;
    for (const url of urls) deps.revokeObjectUrl(url);
    urls.length = 0;
  });

  /** 素材 1 つの URL。読めない・無いときは undefined(失敗しても、残りは続ける)。 */
  async function urlOf(name: string | undefined): Promise<string | undefined> {
    if (!name) return undefined;
    try {
      const blob = await deps.blobOf(name);
      if (disposed || !blob) return undefined;
      const url = deps.createObjectUrl(blob);
      urls.push(url);
      return url;
    } catch (error) {
      console.warn("[ScreenMedia] failed to load media", name, error);
      return undefined;
    }
  }

  return {
    async attach(items) {
      for (const item of items) {
        const [imageUrl, seUrl] = [await urlOf(item.image), await urlOf(item.se)];
        if (disposed) return;
        if (imageUrl) item.imageUrl = imageUrl;
        if (seUrl) item.seUrl = seUrl;
      }
    },
  };
}

export interface ScreenMediaOptions<TConfig> {
  screenName: string;
  settingName: string;
  /** 保存されている設定(無ければ null)を、画面の設定にする。 */
  parse(raw: unknown): TConfig;
  /** 設定が参照している素材の項目(画像・効果音)。URL を付ける対象。 */
  items(config: TConfig): ReadonlyArray<MediaItem>;
  /** 画面が出てから BGM を鳴らし始めるまでの待ち（ミリ秒）。 */
  bgmDelayMs?: number;
}

export interface ScreenMedia<TConfig> {
  /** 素材の準備が終わった設定。準備中は null（画面は「読み込み中」を出す）。 */
  config: ShallowRef<TConfig | null>;
}

/**
 * 画面設定（BGM の名前 `bgm` と、素材を参照する項目）を読み、BGM と画像・効果音の URL を用意して、
 * **準備ができてから** `config` を出し、BGM を流す（画面が出た時点で素材が揃っている）。
 */
export function useScreenMedia<TConfig extends { bgm: string }>(
  options: ScreenMediaOptions<TConfig>,
  deps: MediaDeps = defaultMediaDeps()
): ScreenMedia<TConfig> {
  const config: ShallowRef<TConfig | null> = shallowRef(null);
  const sound = useScreenSound(deps.blobOf);
  const assetUrls = useScreenAssetUrls(deps);
  let disposed = false;
  onScopeDispose(() => {
    disposed = true;
  });

  onMounted(async () => {
    let raw: unknown = null;
    try {
      raw = await deps.fetchSetting(options.screenName, options.settingName);
    } catch (error) {
      // 設定が読めなくても、既定の設定で画面は出す（「読み込み中」のまま固まらないように）
      console.error(`[ScreenMedia] failed to load ${options.screenName} settings`, error);
    }
    const loaded = options.parse(raw);
    if (disposed) return;
    await sound.preload(loaded.bgm);
    await assetUrls.attach(options.items(loaded));
    if (disposed) return;
    config.value = loaded;
    void sound.play(loaded.bgm, options.bgmDelayMs);
  });

  return { config };
}
