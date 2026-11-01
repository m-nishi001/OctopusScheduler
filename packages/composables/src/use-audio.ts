/// <reference lib="dom" />
import { getCurrentScope, onScopeDispose, readonly, ref } from "vue";

export interface PlayOptions {
  /** 繰り返し再生する（BGM 向け）。 */
  isRepeat?: boolean;
}

/**
 * 画面の BGM を1曲ぶん扱う（読み込み → 再生 → 停止）。HTML の `<audio>` で鳴らす。
 *
 *   - `load` は、いま読み込んでいる曲を止めて破棄してから、新しい曲に差し替える（Blob の URL もここで破棄する）。
 *   - 自動再生がブラウザに止められたら、音を出さずに再生を始め（`autoplayBlocked`）、利用者の操作から
 *     `tryResume` を呼ぶと音が出る。
 *   - 管理画面の「音声を止める」（`stopAudio` を、音声の指定なしで通知）では止まる。特定の音声を指定した
 *     停止（予定イベントで流した音声を止める）では止まらない。
 *   - 画面（スコープ）を離れたら、止めて URL を破棄する。
 */
export function useAudio() {
  const isPlaying = ref(false);
  const volume = ref(1);
  const error = ref<Error | null>(null);
  const currentSrc = ref("");
  /** 自動再生が止められて、いまは音が出ていない。利用者の操作で `tryResume` すると出る。 */
  const autoplayBlocked = ref(false);

  let audio: HTMLAudioElement | null = null;
  let blobUrl: string | null = null;

  /** 鳴らしている曲を止めて捨てる（Blob の URL も破棄）。 */
  const release = (): void => {
    if (audio) {
      audio.pause();
      audio = null;
    }
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      blobUrl = null;
    }
    isPlaying.value = false;
    autoplayBlocked.value = false;
    currentSrc.value = "";
  };

  /** 曲を読み込む（再生は {@link play}）。すでに曲があれば、止めて差し替える。 */
  async function load(source: string | Blob): Promise<void> {
    release();
    error.value = null;
    const url = typeof source === "string" ? source : (blobUrl = URL.createObjectURL(source));
    const element = new Audio(url);
    element.volume = volume.value;
    element.addEventListener("playing", () => (isPlaying.value = true));
    element.addEventListener("pause", () => (isPlaying.value = false));
    element.addEventListener("ended", () => (isPlaying.value = false));
    element.addEventListener("error", () => {
      isPlaying.value = false;
      error.value = new Error(`audio failed to load: ${url}`);
    });
    audio = element;
    currentSrc.value = url;
  }

  /** 読み込んだ曲を再生する。曲が無い・すでに鳴っているときは何もしない。 */
  async function play(options: PlayOptions = {}): Promise<void> {
    const element = audio;
    if (!element || isPlaying.value) return;
    element.loop = options.isRepeat ?? false;
    try {
      await element.play();
      autoplayBlocked.value = false;
    } catch (cause) {
      // 自動再生が止められた。音を出さずに再生を始めておき、利用者の操作で音を出す（tryResume）。
      error.value = cause as Error;
      try {
        element.muted = true;
        await element.play();
        autoplayBlocked.value = true;
      } catch (fallback) {
        console.error("[useAudio] failed to play", fallback);
      }
    }
  }

  /**
   * 自動再生で止められていた曲の音を出す。利用者の操作（クリック・キー）の中から呼ぶ。
   * @returns 音が出る状態になったか
   */
  async function tryResume(): Promise<boolean> {
    if (!audio || !autoplayBlocked.value) return false;
    try {
      audio.muted = false;
      await audio.play();
      autoplayBlocked.value = false;
      return true;
    } catch (cause) {
      console.warn("[useAudio] failed to resume", cause);
      return false;
    }
  }

  function pause(): void {
    audio?.pause();
  }

  /** 止めて、先頭に戻す。 */
  async function stop(): Promise<void> {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    isPlaying.value = false;
  }

  /** 音量（0〜1）。次に読み込む曲にも引き継ぐ。 */
  function setVolume(next: number): void {
    volume.value = Math.max(0, Math.min(1, next));
    if (audio) audio.volume = volume.value;
  }

  if (getCurrentScope()) {
    onScopeDispose(release);
  }

  return {
    isPlaying: readonly(isPlaying),
    volume: readonly(volume),
    error: readonly(error),
    currentSrc: readonly(currentSrc),
    autoplayBlocked: readonly(autoplayBlocked),
    load,
    play,
    pause,
    stop,
    setVolume,
    tryResume,
  };
}
