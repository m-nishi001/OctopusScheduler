import { ref, readonly, onUnmounted } from 'vue';
import { AudioService } from '../../common-lib/src/audio/audio-service';

/**
 * AudioServiceの機能をラップし、Vueのリアクティブな状態と統合するComposable関数
 * @returns オーディオ再生を制御するためのリアクティブな状態とメソッド
 */
export function useAudio() {
    // AudioServiceのインスタンスを生成
    // このインスタンスはComposableが呼び出されるたびに新しく作成されます
    const audioService = new AudioService();

    // リアクティブな状態
    const audioInstanceId = ref<string | null>(null);
    const isLoading = ref(false);
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const volume = ref(1);
    const error = ref<Error | null>(null);

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
            // 既存のインスタンスがあれば破棄する
            if (audioInstanceId.value) {
                audioService.disposeInstance(audioInstanceId.value);
            }

            let id: string;
            if (typeof source === 'string') {
                id = await audioService.loadFromUrl(source);
            } else {
                id = await audioService.loadFromBlob(source);
            }

            audioInstanceId.value = id;
            duration.value = audioService.getDuration(id);
            volume.value = audioService.getVolume(id);
        } catch (err) {
            error.value = err as Error;
            console.error('Failed to load audio:', err);
        } finally {
            isLoading.value = false;
        }
    };

    /**
     * ロードされたオーディオを再生する
     * @param options 再生オプション
     */
    const play = async (options: { fadeIn?: number; isRepeat?: boolean } = {}) => {
        if (!audioInstanceId.value || isPlaying.value) return;

        try {
            await audioService.play(audioInstanceId.value, options.fadeIn, options.isRepeat);
            isPlaying.value = true;
            // 再生開始時にcurrentTimeの更新を開始
            if (updateTimerId === null) {
                updateTimerId = setInterval(() => {
                    if (audioInstanceId.value) {
                        currentTime.value = audioService.getCurrentTime(audioInstanceId.value);
                        // 再生が終了したらタイマーを停止する
                        if (currentTime.value >= duration.value && !audioService.getVolume(audioInstanceId.value)) {
                            stop();
                        }
                    }
                }, 100); // 100msごとに更新
            }
        } catch (err) {
            error.value = err as Error;
            console.error('Failed to play audio:', err);
        }
    };

    /**
     * オーディオを一時停止する
     */
    const pause = () => {
        if (!audioInstanceId.value || !isPlaying.value) return;
        audioService.pause(audioInstanceId.value);
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
            await audioService.stop(audioInstanceId.value, fadeOut);
            isPlaying.value = false;
            currentTime.value = 0;
            // タイマーを停止
            if (updateTimerId !== null) {
                clearInterval(updateTimerId);
                updateTimerId = null;
            }
        } catch (err) {
            error.value = err as Error;
            console.error('Failed to stop audio:', err);
        }
    };

    /**
     * オーディオの音量を設定する
     * @param newVolume 新しい音量 (0.0 から 1.0 の範囲)
     */
    const setVolume = (newVolume: number) => {
        if (!audioInstanceId.value) return;
        audioService.setVolume(audioInstanceId.value, newVolume);
        volume.value = audioService.getVolume(audioInstanceId.value);
    };

    // コンポーネントがアンマウントされる際にリソースを解放する
    onUnmounted(() => {
        if (updateTimerId !== null) {
            clearInterval(updateTimerId);
        }
        audioService.disposeAll();
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

        // メソッド
        load,
        play,
        pause,
        stop,
        setVolume,
    };
}
