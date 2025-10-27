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
  const bgmMode = options?.bgmMode;
  const assetService = options?.assetService;
  const screenSettingsService = options?.screenSettingsService;

  // Web Audio mode
  const audioService = mode === "web-audio" ? new AudioService() : null;

  // HTML Audio mode
  const htmlAudio = ref<HTMLAudioElement | null>(null);

  // 共通のリアクティブな状態
  const audioInstanceId = ref<string | null>(null);
  const isLoading = ref(false);
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(1);
  const error = ref<Error | null>(null);
  const currentSrc = ref<string>("");

  // HTML Audio specific
  const loop = ref(false);

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

  // currentTimeを更新するためのタイマーID
  let updateTimerId: ReturnType<typeof setInterval> | null = null;

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
        // 既存のインスタンスがあれば破棄する
        if (audioInstanceId.value) {
          audioService.disposeInstance(audioInstanceId.value);
        }

        let id: string;
        if (typeof source === "string") {
          id = await audioService.loadFromUrl(source);
        } else {
          id = await audioService.loadFromBlob(source);
        }

        audioInstanceId.value = id;
        duration.value = audioService.getDuration(id);
        volume.value = audioService.getVolume(id);
      } else if (mode === "html-audio") {
        if (htmlAudio.value) {
          htmlAudio.value.pause();
          htmlAudio.value.src = "";
        }
        htmlAudio.value = new Audio(
          typeof source === "string" ? source : URL.createObjectURL(source)
        );
        htmlAudio.value.volume = volume.value;
        currentSrc.value = typeof source === "string" ? source : "";
        duration.value = htmlAudio.value.duration || 0;
        audioInstanceId.value = "html-audio"; // dummy id
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
      if (mode === "web-audio" && audioService && audioInstanceId.value) {
        await audioService.play(
          audioInstanceId.value,
          options.fadeIn,
          options.isRepeat
        );
        isPlaying.value = true;
        // 再生開始時にcurrentTimeの更新を開始
        if (updateTimerId === null) {
          updateTimerId = setInterval(() => {
            if (audioInstanceId.value && audioService) {
              currentTime.value = audioService.getCurrentTime(
                audioInstanceId.value
              );
              // 再生が終了したらタイマーを停止する
              if (
                currentTime.value >= duration.value &&
                !audioService.getVolume(audioInstanceId.value)
              ) {
                stop();
              }
            }
          }, 100); // 100msごとに更新
        }
      } else if (mode === "html-audio" && htmlAudio.value) {
        htmlAudio.value.loop = options.isRepeat ?? false;
        await htmlAudio.value.play();
        isPlaying.value = true;
        if (updateTimerId === null) {
          updateTimerId = setInterval(() => {
            if (htmlAudio.value) {
              currentTime.value = htmlAudio.value.currentTime;
              if (htmlAudio.value.ended) {
                isPlaying.value = false;
                clearInterval(updateTimerId!);
                updateTimerId = null;
              }
            }
          }, 100);
        }
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
    if (mode === "web-audio" && audioService && audioInstanceId.value) {
      audioService.pause(audioInstanceId.value);
    } else if (mode === "html-audio" && htmlAudio.value) {
      htmlAudio.value.pause();
    }
    isPlaying.value = false;
    // タイマーを停止
    if (updateTimerId !== null) {
      clearInterval(updateTimerId);
      updateTimerId = null;
    }
  };

  /**
   * オーディオを停止する
   * @param fadeOut フェードアウト時間 (ミリ秒)
   */
  const stop = async (fadeOut: number = 0) => {
    if (!audioInstanceId.value) return;

    try {
      if (mode === "web-audio" && audioService && audioInstanceId.value) {
        await audioService.stop(audioInstanceId.value, fadeOut);
      } else if (mode === "html-audio" && htmlAudio.value) {
        htmlAudio.value.pause();
        htmlAudio.value.currentTime = 0;
        if (
          typeof currentSrc.value === "string" &&
          currentSrc.value.startsWith("blob:")
        ) {
          URL.revokeObjectURL(currentSrc.value);
        }
      }
      isPlaying.value = false;
      currentTime.value = 0;
      // タイマーを停止
      if (updateTimerId !== null) {
        clearInterval(updateTimerId);
        updateTimerId = null;
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
    if (mode === "web-audio" && audioService && audioInstanceId.value) {
      audioService.setVolume(audioInstanceId.value, volume.value);
    } else if (mode === "html-audio" && htmlAudio.value) {
      htmlAudio.value.volume = volume.value;
    }
  };

  /**
   * ランダムにメンバーのBGMを再生する (BGMモード用)
   */
  const playRandomMemberBgm = async () => {
    if (!assetService || !screenSettingsService || bgmMode !== "random-member")
      return;
    try {
      await loadGlobalVolume();
      const cfg = await screenSettingsService.fetchScreenSetting(
        "main",
        "main-screen-settings"
      );
      if (
        !cfg ||
        !cfg.memberLotteryBgms ||
        cfg.memberLotteryBgms.length === 0
      ) {
        return; // no BGM set
      }
      const bgmIds: string[] = cfg.memberLotteryBgms.filter(
        (id: string) => id && id.trim()
      );
      if (bgmIds.length === 0) return;

      const randomId = bgmIds[Math.floor(Math.random() * bgmIds.length)];
      const asset = await assetService.getAssetDataById(randomId);
      if (asset && asset.blob) {
        await stop(); // stop any current
        await load(asset.blob);
        await play({ isRepeat: true }); // loop for draw duration
      }
    } catch (e) {
      console.error("Failed to play member BGM:", e);
    }
  };

  /**
   * グローバルボリュームをロードして設定する
   */
  const loadGlobalVolume = async () => {
    if (!screenSettingsService) return;
    try {
      const cfg = await screenSettingsService.fetchScreenSetting(
        "main",
        "global-volume"
      );
      if (cfg && typeof cfg.volume === "number") {
        setVolume(cfg.volume);
      }
    } catch (e) {
      console.error("Failed to load global volume:", e);
    }
  };

  // コンポーネントがアンマウントされる際にリソースを解放する
  onUnmounted(() => {
    if (updateTimerId !== null) {
      clearInterval(updateTimerId);
    }
    if (mode === "web-audio" && audioService) {
      audioService.disposeAll();
    } else if (mode === "html-audio" && htmlAudio.value) {
      htmlAudio.value.pause();
      if (currentSrc.value.startsWith("blob:")) {
        URL.revokeObjectURL(currentSrc.value);
      }
    }
  });

  // 公開する状態とメソッド
  return {
    // 状態
    audioInstanceId: readonly(audioInstanceId),
    isLoading: readonly(isLoading),
    isPlaying: readonly(isPlaying),
    currentTime: readonly(currentTime),
    duration: readonly(duration),
    volume, // setVolumeがあるため、refを直接返す
    error: readonly(error),
    currentSrc: readonly(currentSrc),
    loop: readonly(loop),

    // メソッド
    load,
    play,
    pause,
    stop,
    setVolume,
    seek,
    setLoop,
    playRandomMemberBgm,
  };
}
