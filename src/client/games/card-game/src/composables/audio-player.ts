import { ref, onMounted, onUnmounted, watch, computed } from 'vue';

/**
 * @typedef {Object} AudioPlayerOptions
 * @property {boolean} [loop=false] - 音楽をループ再生するかどうか。デフォルトはfalse。
 * @property {number} [volume=0.5] - 初期ボリューム。0.0（無音）から1.0（最大）の範囲。デフォルトは0.5。
 */

/**
 * 汎用的なオーディオプレイヤーのロジックを提供するコンポーザブル。
 * 各Vueコンポーネントで音楽再生を簡単に制御できます。
 *
 * @param {string} [initialSrc=''] - 初期に読み込む音楽ファイルのパス。
 * @param {AudioPlayerOptions} [options] - オーディオプレイヤーのオプション。
 *
 * @returns {Object} 音楽プレイヤーの状態と操作メソッド。
 * @property {Ref<boolean>} isPlaying - 現在音楽が再生中かどうかを示すリアクティブな真偽値。
 * @property {Ref<number>} currentTime - 現在の再生時間（秒単位）を示すリアクティブな数値。
 * @property {Ref<number>} duration - 音楽の総再生時間（秒単位）を示すリアクティブな数値。
 * @property {Ref<number>} volume - 現在のボリューム（0.0〜1.0）を示すリアクティブな数値。
 * @property {Ref<boolean>} loop - ループ再生が有効かどうかを示すリアクティブな真偽値。
 * @property {Ref<string | null>} currentSrc - 現在設定されている音楽ファイルのパス。
 * @property {Ref<boolean>} isLoading - 音楽ファイルのロード中かどうかを示すリアクティブな真偽値。
 * @property {Ref<string | null>} error - 発生したエラーメッセージを示すリアクティブな文字列、またはnull。
 * @property {Function} play - 音楽の再生を開始する関数。ブラウザの自動再生ポリシーにより、ユーザーの操作が必要な場合があります。
 * @property {Function} pause - 音楽の一時停止をする関数。
 * @property {Function} stop - 音楽を停止し、再生位置を最初に戻す関数。
 * @property {Function} setSrc - 再生する音楽ファイルのパスを設定する関数。
 * @property {Function} setVolume - ボリュームを設定する関数（0.0〜1.0）。
 * @property {Function} setLoop - ループ再生のオン/オフを設定する関数。
 * @property {ComputedRef<string>} formattedCurrentTime - 現在の再生時間を "MM:SS" 形式でフォーマットした計算プロパティ。
 * @property {ComputedRef<string>} formattedDuration - 総再生時間を "MM:SS" 形式でフォーマットした計算プロパティ。
 */
export function useAudioPlayer(initialSrc: string = '', options?: { loop?: boolean; volume?: number; }) {
    const audio = ref<HTMLAudioElement | null>(null);

    // プレイヤーの内部状態
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const volume = ref(options?.volume ?? 0.5); // デフォルトボリュームは0.5
    const loop = ref(options?.loop ?? false); // デフォルトでループしない
    const src = ref(initialSrc); // 現在読み込まれている音楽ファイルのパス
    const isLoading = ref(false); // ロード中かどうかの状態
    const error = ref<string | null>(null); // エラーメッセージ

    // --- ライフサイクルフックとイベントリスナーの設定 ---
    onMounted(() => {
        // コンポーネントがマウントされた時にHTMLAudioElementのインスタンスを作成
        audio.value = new Audio(src.value);

        // 初期ボリュームとループ設定を適用
        audio.value.volume = volume.value;
        audio.value.loop = loop.value;

        // 各種イベントリスナーを設定し、リアクティブな状態を更新
        audio.value.addEventListener('play', () => { isPlaying.value = true; error.value = null; });
        audio.value.addEventListener('pause', () => { isPlaying.value = false; });
        audio.value.addEventListener('ended', () => { isPlaying.value = false; currentTime.value = 0; });
        audio.value.addEventListener('timeupdate', () => { currentTime.value = audio.value?.currentTime ?? 0; });
        audio.value.addEventListener('loadedmetadata', () => {
            duration.value = audio.value?.duration ?? 0;
            isLoading.value = false;
            error.value = null;
        });
        audio.value.addEventListener('loading', () => { isLoading.value = true; error.value = null; });
        audio.value.addEventListener('error', (e) => {
            console.error("Audio error:", e);
            error.value = "音声ファイルのロードまたは再生中にエラーが発生しました。";
            isLoading.value = false;
            isPlaying.value = false;
        });
    });

    onUnmounted(() => {
        // コンポーネントがアンマウントされる際にリソースを解放
        if (audio.value) {
            audio.value.pause(); // 再生中なら停止
            audio.value.src = ''; // 音源URLをクリアしてリソース解放
            audio.value = null; // ガベージコレクションを助ける
        }
    });

    // --- 状態変更のウォッチャー ---
    watch(src, (newSrc) => {
        // `src` プロパティが変更されたら、新しい音源をロード
        if (audio.value && newSrc) {
            audio.value.src = newSrc;
            audio.value.load(); // 新しいソースを読み込む
            isPlaying.value = false; // ソース変更時は一時停止状態にする
            isLoading.value = true;
            error.value = null;
            currentTime.value = 0; // 再生時間をリセット
        } else if (audio.value) {
            audio.value.src = ''; // srcが空の場合は音源をクリア
            isPlaying.value = false;
            isLoading.value = false;
            currentTime.value = 0;
            duration.value = 0;
        }
    });

    watch(volume, (newVolume) => {
        // `volume` プロパティが変更されたら、audio要素に反映
        if (audio.value) {
            audio.value.volume = newVolume;
        }
    });

    watch(loop, (newLoop) => {
        // `loop` プロパティが変更されたら、audio要素に反映
        if (audio.value) {
            audio.value.loop = newLoop;
        }
    });

    // --- プレイヤー操作メソッド ---
    /**
     * 音楽の再生を開始します。
     * ブラウザの自動再生ポリシーにより、ユーザーの操作（クリックなど）なしでは再生できない場合があります。
     */
    const play = async () => {
        if (!audio.value || !src.value) {
            error.value = "再生する音楽ファイルが設定されていません。`setSrc()` で設定してください。";
            console.warn(error.value);
            return;
        }
        if (isPlaying.value) return; // 既に再生中なら何もしない

        try {
            await audio.value.play();
            // `isPlaying` の更新はイベントリスナーで行われる
        } catch (e) {
            console.warn("音楽の再生に失敗しました。ユーザーの操作が必要な場合があります。", e);
            error.value = "音楽の再生がブラウザによってブロックされました。";
            isPlaying.value = false;
        }
    };

    /**
     * 音楽の一時停止をします。
     */
    const pause = () => {
        if (audio.value) {
            audio.value.pause();
            // `isPlaying` の更新はイベントリスナーで行われる
        }
    };

    /**
     * 音楽を停止し、再生位置を最初に戻します。
     */
    const stop = () => {
        if (audio.value) {
            audio.value.pause();
            audio.value.currentTime = 0;
            // `isPlaying` の更新はイベントリスナーで行われる
        }
    };

    /**
     * 再生する音楽ファイルのパスを設定します。
     * 新しいパスを設定すると、自動的にそのファイルをロードします。
     * @param {string} newSrc - 新しい音楽ファイルのパス。
     */
    const setSrc = (newSrc: string) => {
        src.value = newSrc;
    };

    /**
     * 再生位置（秒単位）を設定します。
     * @param {number} time - 設定したい再生時間（秒）。
     */
    const seek = (time: number) => {
        if (audio.value && !isNaN(time) && time >= 0 && time <= duration.value) {
            audio.value.currentTime = time;
        }
    };

    /**
     * ボリュームを設定します。
     * @param {number} newVolume - 設定したいボリューム（0.0〜1.0の範囲）。
     */
    const setVolume = (newVolume: number) => {
        volume.value = Math.max(0, Math.min(1, newVolume)); // 0から1の範囲に制限
    };

    /**
     * ループ再生のオン/オフを設定します。
     * @param {boolean} enableLoop - trueでループ再生を有効、falseで無効。
     */
    const setLoop = (enableLoop: boolean) => {
        loop.value = enableLoop;
    };

    // --- フォーマットされた時間表示の計算プロパティ ---
    const formatTime = (seconds: number): string => {
        if (isNaN(seconds) || !isFinite(seconds)) return '0:00'; // NaNやInfinityを考慮
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    };

    const formattedCurrentTime = computed(() => formatTime(currentTime.value));
    const formattedDuration = computed(() => formatTime(duration.value));

    return {
        // --- 状態（リアクティブ） ---
        /** 音楽が再生中かどうか */
        isPlaying,
        /** 現在の再生時間（秒） */
        currentTime,
        /** 音楽の総再生時間（秒） */
        duration,
        /** 現在のボリューム（0.0〜1.0） */
        volume,
        /** ループ再生が有効かどうか */
        loop,
        /** 現在読み込まれている音楽ファイルのパス */
        currentSrc: src,
        /** 音楽ファイルのロード中かどうか */
        isLoading,
        /** 発生したエラーメッセージ */
        error,

        // --- メソッド ---
        /** 音楽の再生を開始します。 */
        play,
        /** 音楽を一時停止します。 */
        pause,
        /** 音楽を停止し、最初に戻します。 */
        stop,
        /** 再生する音楽ファイルのパスを設定します。 */
        setSrc,
        /** 再生位置を設定します。 */
        seek,
        /** ボリュームを設定します。 */
        setVolume,
        /** ループ再生のオン/オフを設定します。 */
        setLoop,

        // --- 計算プロパティ（フォーマット済み表示） ---
        /** 現在の再生時間を "MM:SS" 形式でフォーマットした文字列 */
        formattedCurrentTime,
        /** 総再生時間を "MM:SS" 形式でフォーマットした文字列 */
        formattedDuration,
    };
}

/*
 * --- useAudioPlayer の使用例 ---
 *
 * 【基本的な使い方】
 * 1. コンポーネントの <script setup> ブロック内で useAudioPlayer をインポートします。
 * 2. プレイヤーを初期化し、必要な状態やメソッドを分割代入で取得します。
 * 引数に音楽ファイルのパスを渡すことで、初期ロードが可能です。
 *
 * 例1: 特定の音楽を再生・一時停止するだけのシンプルなプレイヤー
 * <template>
 * <div>
 * <h3>背景音楽プレイヤー</h3>
 * <p>現在の状態: {{ isPlaying ? '再生中' : '一時停止中' }}</p>
 * <button @click="togglePlayPause">{{ isPlaying ? '一時停止' : '再生' }}</button>
 * <button @click="stop">停止</button>
 * </div>
 * </template>
 *
 * <script setup lang="ts">
 * import { useAudioPlayer } from '@/composables/useAudioPlayer'; // パスを適切に調整
 * import { onMounted } from 'vue';
 *
 * // プレイヤーを初期化（初期音源を指定）
 * const { isPlaying, play, pause, stop } = useAudioPlayer('/audio/background_music.mp3', { loop: true });
 *
 * // (オプション) コンポーネントがマウントされたらすぐに再生を試みる
 * // 注意: ブラウザの自動再生ポリシーにより、ユーザーの操作なしには再生がブロックされる場合があります。
 * // onMounted(() => {
 * //   play();
 * // });
 *
 * const togglePlayPause = () => {
 * if (isPlaying.value) {
 * pause();
 * } else {
 * play();
 * }
 * };
 * </script>
 *
 *
 * 【より高度な使い方: 進行状況、ボリューム、動的な音源変更】
 * 例2: 音楽ファイルのパスを動的に変更し、再生状態や進行状況を表示するプレイヤー
 * <template>
 * <div>
 * <h3>カスタム音楽プレイヤー</h3>
 * <p v-if="error" style="color: red;">エラー: {{ error }}</p>
 * <p>現在のファイル: {{ currentSrc?.split('/').pop() || '未選択' }}</p>
 * <p>状態: {{ isLoading ? 'ロード中...' : (isPlaying ? '再生中' : '一時停止中') }}</p>
 *
 * <label for="music-select">楽曲を選択:</label>
 * <select id="music-select" v-model="selectedMusicPath" @change="setSrc(selectedMusicPath)">
 * <option value="/audio/song1.mp3">希望の歌</option>
 * <option value="/audio/song2.mp3">静かな夜</option>
 * <option value="/audio/effects/chime.wav">チャイム効果音</option>
 * <option value="">--選択なし--</option>
 * </select>
 *
 * <button @click="play" :disabled="!currentSrc || isPlaying || isLoading">再生</button>
 * <button @click="pause" :disabled="!isPlaying">一時停止</button>
 * <button @click="stop" :disabled="!currentSrc">停止</button>
 *
 * <p>時間: {{ formattedCurrentTime }} / {{ formattedDuration }}</p>
 * <input
 * type="range"
 * :value="currentTime"
 * :max="duration"
 * @input="seek($event.target.valueAsNumber)"
 * :disabled="!currentSrc || duration === 0"
 * />
 *
 * <p>ボリューム: {{ Math.round(volume * 100) }}%</p>
 * <input
 * type="range"
 * :value="volume * 100"
 * @input="setVolume($event.target.valueAsNumber / 100)"
 * min="0" max="100"
 * />
 *
 * <label>
 * <input type="checkbox" v-model="loop" /> ループ再生
 * </label>
 * </div>
 * </template>
 *
 * <script setup lang="ts">
 * import { ref, watch } from 'vue';
 * import { useAudioPlayer } from '@/composables/useAudioPlayer'; // パスを適切に調整
 *
 * const selectedMusicPath = ref('/audio/song1.mp3'); // セレクトボックスの初期値
 *
 * // プレイヤーを初期化（今回は初期音源は指定せず、後からセット）
 * const {
 * isPlaying,
 * currentTime,
 * duration,
 * volume,
 * loop, // v-modelで双方向バインディングするために直接取得
 * currentSrc,
 * isLoading,
 * error,
 * play,
 * pause,
 * stop,
 * setSrc,
 * seek,
 * setVolume,
 * setLoop, // checkboxで直接操作する場合に必要
 * formattedCurrentTime,
 * formattedDuration,
 * } = useAudioPlayer(selectedMusicPath.value, { volume: 0.7 }); // 初期ボリュームを0.7に設定
 *
 * // (オプション) selectedMusicPath が変更されたら自動的に音源を切り替える
 * // setSrcを@changeイベントで直接呼ぶ場合は不要だが、watchで制御することも可能
 * // watch(selectedMusicPath, (newPath) => {
 * //   setSrc(newPath);
 * // });
 * </script>
 *
 *
 * 【複数のプレイヤーインスタンスを作成する】
 * 例3: 複数の独立した効果音を管理する
 * <template>
 * <div>
 * <h3>効果音セレクション</h3>
 * <button @click="playClickSound">クリック音を再生</button>
 * <button @click="playDingSound">チャイム音を再生</button>
 * <button @click="stopAll">全て停止</button>
 * </div>
 * </template>
 *
 * <script setup lang="ts">
 * import { useAudioPlayer } from '@/composables/useAudioPlayer';
 *
 * // 独立したプレイヤーインスタンスを複数作成
 * const { play: playClickSound, stop: stopClickSound } = useAudioPlayer('/audio/effects/click.wav');
 * const { play: playDingSound, stop: stopDingSound } = useAudioPlayer('/audio/effects/ding.wav');
 *
 * const stopAll = () => {
 * stopClickSound();
 * stopDingSound();
 * };
 * </script>
 *
 *
 * 【重要事項】
 * - **自動再生ポリシー:** 多くのブラウザは、ユーザーの直接的な操作（クリック、タッチなど）なしでの音声の自動再生をブロックします。
 * `play()` メソッドを呼び出しても、ユーザーがページを操作するまで再生が開始されない場合があります。
 * この場合、コンソールに警告が表示され、`play()` はPromiseをrejectします。
 * 初めての再生はボタンクリックなどのユーザーインタラクション内で行うことを推奨します。
 * - **ファイルのパス:** `/audio/sample.mp3` のようなパスは、Viteプロジェクトの `public` ディレクトリに配置されているファイルを指します。
 * 例: `your-project/public/audio/sample.mp3`
 * - **TypeScriptの型:** `useAudioPlayer` が返す値は全て型付けされているため、IDEのオートコンプリートが役立ちます。
 *
 */