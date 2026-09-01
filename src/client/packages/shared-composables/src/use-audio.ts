/// <reference lib="dom" />
import { ref, readonly, onUnmounted } from "vue";
import { AudioService } from "@common-lib/audio/audio-service";
import { eventBus } from "../../../octopus-scheduler/src/core/event-bus";

// Debug flag: enable by setting window.__DBG_AUDIO__ = true or localStorage.setItem('__DBG_AUDIO__','1')
const __DBG_AUDIO__ = !!(
  typeof window !== "undefined" &&
  ((window as any).__DBG_AUDIO__ ||
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("__DBG_AUDIO__") === "1"))
);
let __dbgAudioCounter = 0;
const __makeDbgId = () => `audio#${++__dbgAudioCounter}`;

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

  const _instanceId = Math.random().toString(36).slice(2);
  const instanceId = ref<string>(_instanceId);

  const audioInstanceId = ref<string | null>(null);
  const isLoading = ref(false);
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(1);
  const error = ref<Error | null>(null);
  const currentSrc = ref<string>("");

  const loop = ref(false);
  const autoplayBlocked = ref(false);
  const tryResume = async () => {
    if (mode === "html-audio" && htmlAudio.value && autoplayBlocked.value) {
      try {
        console.log(
          "[useAudio] tryResume: attempting to resume after user gesture"
        );
        await htmlAudio.value.play();
        autoplayBlocked.value = false;
        isPlaying.value = true;
        console.log("[useAudio] tryResume: resumed playback");
        return true;
      } catch (err) {
        console.warn("[useAudio] tryResume: failed to resume", err);
        return false;
      }
    }
    return false;
  };

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
      // Pause and reset playback position but DO NOT revoke the object URL here.
      // Revocation is performed when loading a new source or on unmount to avoid
      // races where an external stop call clears the tracked src while another
      // actor expects to read it immediately after play.
      console.log(
        "[useAudio] stopAudio: pausing (defer revoke) currentSrc =>",
        currentSrc.value
      );
      // 無条件で trace を出力して必ずスタックを取得
      try {
        console.trace();
      } catch (e) {
        /* noop */
      }
      if (__DBG_AUDIO__) {
        console.log(
          "[DBG][useAudio] stopAudio PRE dbgId=%s currentSrc=%s time=%d",
          (htmlAudio.value as any)?.__dbgId ?? "nil",
          currentSrc.value,
          Date.now()
        );
      }
      htmlAudio.value.pause();
      htmlAudio.value.currentTime = 0;
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

    // Only stop when we have a valid duration (> 0). When audio metadata
    // hasn't loaded yet duration may be 0 which would falsely trigger stop()
    // immediately after play resolves. Use void to ignore returned Promise.
    if (duration.value > 0 && currentTime.value >= duration.value) {
      void stop();
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

  const getHtmlAudioState = () => {
    try {
      return {
        muted: htmlAudio.value?.muted ?? null,
        volume: htmlAudio.value?.volume ?? null,
        paused: htmlAudio.value?.paused ?? null,
        readyState: htmlAudio.value?.readyState ?? null,
        // tracked src (object URL or provided string)
        src: currentSrc.value ?? null,
        // actual HTMLAudio element src for cross-checking races
        elementSrc: htmlAudio.value?.src ?? null,
      };
    } catch (e) {
      return null;
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
              if (__DBG_AUDIO__) {
                console.log(
                  "[DBG][useAudio] load: revoke PRE dbgId=%s blob=%s time=%d",
                  (htmlAudio.value as any).__dbgId ?? "nil",
                  currentSrc.value,
                  Date.now()
                );
                console.trace();
              }
              // 無条件で trace を出力して必ずスタックを取得
              try {
                console.trace();
              } catch (e) {
                /* noop */
              }
              console.log(
                "[useAudio] load: revoking previous blob URL:",
                currentSrc.value
              );
              URL.revokeObjectURL(currentSrc.value);
            } catch (e) {
              console.warn("[useAudio] load: revoke failed", e);
            }
          }
          htmlAudio.value.src = "";
        }

        const url =
          typeof source === "string" ? source : URL.createObjectURL(source);
        htmlAudio.value = new Audio(url);
        if (__DBG_AUDIO__) {
          try {
            const dbgId = __makeDbgId();
            (htmlAudio.value as any).__dbgId = dbgId;
            console.log(
              "[DBG][useAudio] NEW audio dbgId=%s created src=%s time=%d",
              dbgId,
              url,
              Date.now()
            );
          } catch (e) {
            /* noop */
          }
        }
        // Attach event listeners for debugging and state updates
        const safeAddEvent = (name: string, handler: any) => {
          try {
            htmlAudio.value?.addEventListener(
              name,
              handler as EventListenerOrEventListenerObject
            );
          } catch (e) {
            /* noop */
          }
        };
        safeAddEvent("play", () => {
          if (__DBG_AUDIO__)
            console.log(
              "[EVT][useAudio] play dbgId=%s src=%s paused=%s readyState=%d time=%d",
              (htmlAudio.value as any).__dbgId ?? "nil",
              htmlAudio.value?.src,
              htmlAudio.value?.paused,
              htmlAudio.value?.readyState,
              Date.now()
            );
          else
            console.log("[useAudio] html-audio event: play", {
              src: currentSrc.value,
            });
        });
        safeAddEvent("playing", () => {
          if (__DBG_AUDIO__)
            console.log(
              "[EVT][useAudio] playing dbgId=%s src=%s paused=%s readyState=%d time=%d",
              (htmlAudio.value as any).__dbgId ?? "nil",
              htmlAudio.value?.src,
              htmlAudio.value?.paused,
              htmlAudio.value?.readyState,
              Date.now()
            );
          else
            console.log("[useAudio] html-audio event: playing", {
              src: currentSrc.value,
              paused: htmlAudio.value?.paused,
            });
          // Ensure playback is actually audible
          try {
            if (htmlAudio.value) {
              htmlAudio.value.muted = false;
              htmlAudio.value.volume = volume.value ?? 1;
            }
          } catch (e) {
            /* noop */
          }
          isPlaying.value = true;
          autoplayBlocked.value = false;
        });
        // Ensure duration is captured when metadata becomes available
        safeAddEvent("loadedmetadata", () => {
          try {
            duration.value = getDuration();
            if (__DBG_AUDIO__)
              console.log(
                "[useAudio] loadedmetadata dbgId=%s duration=%d",
                (htmlAudio.value as any).__dbgId ?? "nil",
                duration.value
              );
          } catch (e) {
            /* noop */
          }
        });
        safeAddEvent("pause", () => {
          if (__DBG_AUDIO__)
            console.log(
              "[EVT][useAudio] pause dbgId=%s src=%s paused=%s readyState=%d time=%d",
              (htmlAudio.value as any).__dbgId ?? "nil",
              htmlAudio.value?.src,
              htmlAudio.value?.paused,
              htmlAudio.value?.readyState,
              Date.now()
            );
          else
            console.log("[useAudio] html-audio event: pause", {
              src: currentSrc.value,
            });
          isPlaying.value = false;
        });
        safeAddEvent("ended", () => {
          if (__DBG_AUDIO__)
            console.log(
              "[EVT][useAudio] ended dbgId=%s src=%s time=%d",
              (htmlAudio.value as any).__dbgId ?? "nil",
              htmlAudio.value?.src,
              Date.now()
            );
          else
            console.log("[useAudio] html-audio event: ended", {
              src: currentSrc.value,
            });
          isPlaying.value = false;
        });
        safeAddEvent("error", (ev: Event) => {
          if (__DBG_AUDIO__)
            console.error(
              "[EVT][useAudio] error dbgId=%s src=%s ev=%o time=%d",
              (htmlAudio.value as any).__dbgId ?? "nil",
              htmlAudio.value?.src,
              ev,
              Date.now()
            );
          else
            console.error("[useAudio] html-audio event: error", {
              src: currentSrc.value,
              ev,
            });
          isPlaying.value = false;
        });
        // ensure audio is not muted and playable inline
        try {
          htmlAudio.value.muted = false;
          // enable playsInline for mobile browsers
          // @ts-ignore
          htmlAudio.value.playsInline = true;
        } catch {}
        htmlAudio.value.volume = volume.value;
        // currentSrc に実際に設定した URL を保持しておく
        currentSrc.value = typeof source === "string" ? source : url;
        if (__DBG_AUDIO__)
          console.log(
            "[DBG][useAudio] load: set currentSrc dbgId=%s newSrc=%s time=%d",
            (htmlAudio.value as any).__dbgId ?? "nil",
            currentSrc.value,
            Date.now()
          );
        console.log("[useAudio] load: set currentSrc =>", currentSrc.value);
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
      console.log("[useAudio] play: attempting to play", {
        instance: _instanceId,
        audioInstanceId: audioInstanceId.value,
        src: currentSrc.value,
      });
      await playAudio(options.fadeIn, options.isRepeat);
      console.log("[useAudio] play: play succeeded", {
        instance: _instanceId,
        audioInstanceId: audioInstanceId.value,
        src: currentSrc.value,
      });
      if (__DBG_AUDIO__ && mode === "html-audio" && htmlAudio.value) {
        try {
          console.log(
            "[DBG][useAudio] play RESOLVED dbgId=%s paused=%s readyState=%d muted=%s volume=%s elementSrc=%s time=%d",
            (htmlAudio.value as any).__dbgId ?? "nil",
            htmlAudio.value.paused,
            htmlAudio.value.readyState,
            htmlAudio.value.muted,
            htmlAudio.value.volume,
            htmlAudio.value.src,
            Date.now()
          );
        } catch (e) {
          /* noop */
        }
      }
      isPlaying.value = true;
      autoplayBlocked.value = false;
      if (animationFrameId === null) {
        updateCurrentTime();
      }
    } catch (err) {
      error.value = err as Error;
      console.error("Failed to play audio:", err);
      // If autoplay appears to be blocked, attempt muted-play fallback for html-audio.
      if (mode === "html-audio" && htmlAudio.value) {
        try {
          console.warn(
            "[useAudio] autoplay blocked; attempting muted-play fallback"
          );
          const wasMuted = htmlAudio.value.muted;
          htmlAudio.value.muted = true;
          await htmlAudio.value.play();
          isPlaying.value = true;
          autoplayBlocked.value = true;
          // restore muted state (we leave it unmuted to ensure silence until user interacts to unmute)
          htmlAudio.value.muted = wasMuted;
          console.warn(
            "[useAudio] muted-play fallback succeeded; audio remains muted until unmuted by user action"
          );
        } catch (fallbackErr) {
          console.error(
            "[useAudio] muted-play fallback also failed",
            fallbackErr
          );
        }
      }
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

  // subscribe to global stopAudio so external stopAll/stopAudio commands stop this instance
  const onStopAudio = async () => {
    try {
      // immediate stop, ignore fade
      await stop(0);
    } catch {
      // ignore
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
    // remove global stopAudio listener
    try {
      eventBus.off("stopAudio", onStopAudio as any);
    } catch {
      /* ignore */
    }
  });

  try {
    eventBus.on("stopAudio", onStopAudio as any);
  } catch {
    // ignore if eventBus not available
  }
  return {
    instanceId: readonly(instanceId),
    audioInstanceId: readonly(audioInstanceId),
    isLoading: readonly(isLoading),
    isPlaying: readonly(isPlaying),
    currentTime: readonly(currentTime),
    duration: readonly(duration),
    volume: readonly(volume),
    error: readonly(error),
    currentSrc: readonly(currentSrc),
    loop: readonly(loop),
    autoplayBlocked: readonly(autoplayBlocked),

    load,
    play,
    pause,
    stop,
    setVolume,
    seek,
    setLoop,
    tryResume,
    getHtmlAudioState,
  };
}
