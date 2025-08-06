import { ref, onUnmounted, shallowRef } from 'vue';
import { AudioService } from '@common-lib/audio/audio-service';

/**
 * オーディオ再生機能を提供するVue Composable
 * AudioServiceのインスタンスを管理し、リアクティブな状態を提供します。
 */
export function useAudio() {
  // AudioServiceのインスタンスを保持。shallowRefを使用し、リアクティブな深度を浅く保つ
  const audioService = shallowRef(new AudioService());

  // 現在再生中のオーディオインスタンスのID
  const currentPlayingId = ref<string | null>(null);
  // 現在の再生時間 (秒)
  const currentTime = ref(0);
  // 総再生時間 (秒)
  const duration = ref(0);
  // 再生中かどうか
  const isPlaying = ref(false);
  // 現在の音量 (0-1)
  const volume = ref(1);

  let updateInterval: number | null = null; // 再生時間更新用のインターバルID

  /**
   * 再生時間の更新を開始します。
   * @param id 更新対象のオーディオインスタンスID
   */
  const startUpdatingTime = (id: string) => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    updateInterval = setInterval(() => {
      if (audioService.value && id) {
        try {
          // AudioServiceインスタンスが存在し、IDが有効な場合のみ時間を更新
          currentTime.value = audioService.value.getCurrentTime(id);
        } catch (error) {
          // インスタンスが破棄された場合など、エラーを捕捉してインターバルを停止
          if (updateInterval) clearInterval(updateInterval);
          updateInterval = null;
          console.warn("Failed to get current time, stopping update interval:", error);
        }
      }
    }, 100); // 100msごとに更新
  };

  /**
   * 再生時間の更新を停止します。
   */
  const stopUpdatingTime = () => {
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
  };

  /**
   * URLからオーディオファイルをロードします。
   * @param url ロードするオーディオファイルのURL
   * @returns ロードされたオーディオインスタンスのID
   */
  const loadFromUrl = async (url: string): Promise<string> => {
    try {
      const id = await audioService.value.loadFromUrl(url);
      currentPlayingId.value = id; // ロードしたものを現在の対象とする
      duration.value = audioService.value.getDuration(id);
      volume.value = audioService.value.getVolume(id); // AudioServiceにgetVolumeを追加する必要がある
      return id;
    } catch (error) {
      console.error("Failed to load audio from URL:", error);
      throw error;
    }
  };

  /**
   * Blobからオーディオファイルをロードします。
   * @param blob ロードするBlobオブジェクト
   * @returns ロードされたオーディオインスタンスのID
   */
  const loadFromBlob = async (blob: Blob): Promise<string> => {
    try {
      const id = await audioService.value.loadFromBlob(blob);
      currentPlayingId.value = id; // ロードしたものを現在の対象とする
      duration.value = audioService.value.getDuration(id);
      volume.value = audioService.value.getVolume(id); // AudioServiceにgetVolumeを追加する必要がある
      return id;
    } catch (error) {
      console.error("Failed to load audio from Blob:", error);
      throw error;
    }
  };

  /**
   * 指定されたIDのオーディオを再生します。
   * @param id 再生するオーディオインスタンスのID
   * @param fadeIn フェードイン時間 (ミリ秒)。デフォルトは0。
   * @param isRepeat ループ再生するかどうか。デフォルトはfalse。
   */
  const play = async (id: string, fadeIn: number = 0, isRepeat: boolean = false) => {
    try {
      await audioService.value.play(id, fadeIn, isRepeat);
      isPlaying.value = true;
      currentPlayingId.value = id;
      startUpdatingTime(id); // 再生時間更新を開始
    } catch (error) {
      console.error(`Failed to play audio with ID ${id}:`, error);
      isPlaying.value = false;
    }
  };

  /**
   * 指定されたIDのオーディオを一時停止します。
   * @param id 一時停止するオーディオインスタンスのID
   */
  const pause = (id: string) => {
    try {
      audioService.value.pause(id);
      isPlaying.value = false;
      stopUpdatingTime(); // 再生時間更新を停止
    } catch (error) {
      console.error(`Failed to pause audio with ID ${id}:`, error);
    }
  };

  /**
   * 指定されたIDのオーディオを停止します。
   * @param id 停止するオーディオインスタンスのID
   * @param fadeOut フェードアウト時間 (ミリ秒)。デフォルトは0。
   */
  const stop = async (id: string, fadeOut: number = 0) => {
    try {
      await audioService.value.stop(id, fadeOut);
      isPlaying.value = false;
      currentTime.value = 0; // 停止したら再生時間をリセット
      stopUpdatingTime(); // 再生時間更新を停止
      currentPlayingId.value = null; // 現在の再生IDをクリア
    } catch (error) {
      console.error(`Failed to stop audio with ID ${id}:`, error);
    }
  };

  /**
   * 指定されたIDのオーディオの音量を設定します。
   * @param id 音量を設定するオーディオインスタンスのID
   * @param vol 設定する音量 (0.0 から 1.0 の範囲)
   */
  const setVolume = (id: string, vol: number) => {
    try {
      audioService.value.setVolume(id, vol);
      volume.value = vol; // Composableの音量も更新
    } catch (error) {
      console.error(`Failed to set volume for audio with ID ${id}:`, error);
    }
  };

  /**
   * 指定されたIDのオーディオインスタンスを破棄します。
   * @param id 破棄するオーディオインスタンスのID
   */
  const disposeInstance = (id: string) => {
    try {
      if (currentPlayingId.value === id) {
        stopUpdatingTime();
        isPlaying.value = false;
        currentTime.value = 0;
        currentPlayingId.value = null;
      }
      audioService.value.disposeInstance(id);
    } catch (error) {
      console.error(`Failed to dispose instance with ID ${id}:`, error);
    }
  };

  // コンポーネントがアンマウントされた際にすべてのリソースを解放
  onUnmounted(() => {
    if (audioService.value) {
      audioService.value.disposeAll();
      stopUpdatingTime();
    }
  });

  // Composableが提供するプロパティとメソッド
  return {
    currentPlayingId,
    currentTime,
    duration,
    isPlaying,
    volume,
    loadFromUrl,
    loadFromBlob,
    play,
    pause,
    stop,
    setVolume,
    disposeInstance,
  };
}
