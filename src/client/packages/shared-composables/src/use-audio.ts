/// <reference lib="dom" />
import { ref, readonly, onUnmounted } from "vue";
import { AudioService } from "../../common-lib/src/audio/audio-service";

/**
 * AudioServiceの機能をラップし、Vueのリアクティブな状態と統合するComposable関数
 * @param options オプション設定
 * @returns オーディオ再生を制御するためのリアクティブな状態とメソッド
 */
export function useAudio(options?: {
  mode?: "web-audio" | "html-audio";
  bgmMode?: "random-member";
  assetService?: any;
  screenSettingsService?: any;
}) {
  const mode = options?.mode ?? "web-audio";

  const audioService = mode === "web-audio" ? new AudioService() : null;

  const htmlAudio = ref<HTMLAudioElement | null>(null);

  const audioInstanceId = ref<string | null>(null);
  const isLoading = ref(false);
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(1);
  const error = ref<Error | null>(null);
  const currentSrc = ref<string>("");

  const loop = ref(false);

  let animationFrameId: number | null = null;

  const getCurrentTime = (): number => {
    if (mode === "web-audio" && audioService && audioInstanceId.value) {
      return audioService.getCurrentTime(audioInstanceId.value);
    } else if (mode === "html-audio" && htmlAudio.value) {
      return htmlAudio.value.currentTime;
    }
    return 0;
  };

  const getDuration = (): number => {
    if (mode === "web-audio" && audioService && audioInstanceId.value) {
      return audioService.getDuration(audioInstanceId.value);
    } else if (mode === "html-audio" && htmlAudio.value) {
      return htmlAudio.value.duration || 0;
    }
    return 0;
  };

  const playAudio = async (fadeIn?: number, isRepeat?: boolean) => {
    if (mode === "web-audio" && audioService && audioInstanceId.value) {
      await audioService.play(audioInstanceId.value, fadeIn, isRepeat);
    } else if (mode === "html-audio" && htmlAudio.value) {
      htmlAudio.value.loop = isRepeat ?? false;
      await htmlAudio.value.play();
    }
  };

  const pauseAudio = () => {
    if (mode === "web-audio" && audioService && audioInstanceId.value) {
      audioService.pause(audioInstanceId.value);
    } else if (mode === "html-audio" && htmlAudio.value) {
      htmlAudio.value.pause();
    }
  };

  const stopAudio = async (fadeOut: number = 0) => {
    if (mode === "web-audio" && audioService && audioInstanceId.value) {
      await audioService.stop(audioInstanceId.value, fadeOut);
    } else if (mode === "html-audio" && htmlAudio.value) {
      htmlAudio.value.pause();
      htmlAudio.value.currentTime = 0;
      if (currentSrc.value.startsWith("blob:")) {
        URL.revokeObjectURL(currentSrc.value);
      }
      currentSrc.value = "";
    }
  };

  const setVolumeAudio = (newVolume: number) => {
    if (mode === "web-audio" && audioService && audioInstanceId.value) {
      audioService.setVolume(audioInstanceId.value, newVolume);
    } else if (mode === "html-audio" && htmlAudio.value) {
      htmlAudio.value.volume = newVolume;
    }
  };

  const updateCurrentTime = () => {
    if (!isPlaying.value) return;

    currentTime.value = getCurrentTime();

    if (currentTime.value >= duration.value) {
      stop();
      return;
    }

    animationFrameId = requestAnimationFrame(updateCurrentTime);
  };

  /**
   * 再生位置を設定する (HTML Audio用)
   * @param time 設定したい再生時間（秒）
   */
  const seek = (time: number) => {
    if (
      mode === "html-audio" &&
      htmlAudio.value &&
      !isNaN(time) &&
      time >= 0 &&
      time <= duration.value
    ) {
      htmlAudio.value.currentTime = time;
    }
  };

  /**
   * ループ再生のオン/オフを設定する (HTML Audio用)
   * @param enableLoop trueでループ再生有効
   */
  const setLoop = (enableLoop: boolean) => {
    loop.value = enableLoop;
    if (mode === "html-audio" && htmlAudio.value) {
      htmlAudio.value.loop = enableLoop;
    }
  };

  /**
   * URLまたはBlobからオーディオデータをロードする
   * @param source ロードするオーディオファイルのURLまたはBlob
   */
  const load = async (source: string | Blob) => {
    if (isLoading.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      if (mode === "web-audio" && audioService) {
        if (audioInstanceId.value) {
          audioService.disposeInstance(audioInstanceId.value);
        }

        const id =
          typeof source === "string"
            ? await audioService.loadFromUrl(source)
            : await audioService.loadFromBlob(source);

        audioInstanceId.value = id;
        duration.value = getDuration();
        volume.value = audioService.getVolume(id);
      } else if (mode === "html-audio") {
        // HTMLAudio の場合は Blob から作成した object URL を追跡して
        // 再ロードやアンマウント時に revoke できるようにする
        if (htmlAudio.value) {
          htmlAudio.value.pause();
          // 既に設定されている blob URL があれば解放
          if (currentSrc.value && currentSrc.value.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(currentSrc.value);
            } catch {
              /* ignore */
            }
          }
          htmlAudio.value.src = "";
        }

        const url =
          typeof source === "string" ? source : URL.createObjectURL(source);
        htmlAudio.value = new Audio(url);
        htmlAudio.value.volume = volume.value;
        // currentSrc に実際に設定した URL を保持しておく
        currentSrc.value = typeof source === "string" ? source : url;
        duration.value = getDuration();
        audioInstanceId.value = "html-audio";
      }
    } catch (err) {
      error.value = err as Error;
      console.error("Failed to load audio:", err);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * ロードされたオーディオを再生する
   * @param options 再生オプション
   */
  const play = async (
    options: { fadeIn?: number; isRepeat?: boolean } = {}
  ) => {
    if (!audioInstanceId.value || isPlaying.value) return;

    try {
      await playAudio(options.fadeIn, options.isRepeat);
      isPlaying.value = true;
      if (animationFrameId === null) {
        updateCurrentTime();
      }
    } catch (err) {
      error.value = err as Error;
      console.error("Failed to play audio:", err);
    }
  };

  /**
   * オーディオを一時停止する
   */
  const pause = () => {
    if (!audioInstanceId.value || !isPlaying.value) return;
    pauseAudio();
    isPlaying.value = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };

  /**
   * オーディオを停止する
   * @param fadeOut フェードアウト時間 (ミリ秒)
   */
  const stop = async (fadeOut: number = 0) => {
    if (!audioInstanceId.value) return;

    try {
      await stopAudio(fadeOut);
      isPlaying.value = false;
      currentTime.value = 0;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    } catch (err) {
      error.value = err as Error;
      console.error("Failed to stop audio:", err);
    }
  };

  /**
   * オーディオの音量を設定する
   * @param newVolume 新しい音量 (0.0 から 1.0 の範囲)
   */
  const setVolume = (newVolume: number) => {
    volume.value = Math.max(0, Math.min(1, newVolume));
    setVolumeAudio(volume.value);
  };

  // NOTE: BGM-mode specific behavior (previously provided here) has been removed
  // to keep this composable generic. Callers should implement BGM selection
  // and playback control at the call site using load()/play()/stop()/setVolume().

  onUnmounted(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    if (mode === "web-audio" && audioService) {
      audioService.disposeAll();
    } else if (mode === "html-audio" && htmlAudio.value) {
      htmlAudio.value.pause();
      if (currentSrc.value.startsWith("blob:")) {
        URL.revokeObjectURL(currentSrc.value);
      }
    }
    // all blob URLs are revoked from currentSrc when appropriate; nothing extra to do here
  });

  return {
    // public API (object-url helpers are internal and not exposed)
    audioInstanceId: readonly(audioInstanceId),
    isLoading: readonly(isLoading),
    isPlaying: readonly(isPlaying),
    currentTime: readonly(currentTime),
    duration: readonly(duration),
    volume: readonly(volume),
    error: readonly(error),
    currentSrc: readonly(currentSrc),
    loop: readonly(loop),

    load,
    play,
    pause,
    stop,
    setVolume,
    seek,
    setLoop,
  };
}
