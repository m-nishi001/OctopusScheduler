/**
 * Web Audio API を使用して複数のオーディオソースを管理するサービス
 */
export class AudioService {
    /**
     * AudioServiceのコンストラクタ
     * AudioContextを初期化し、オーディオインスタンスを管理するMapを準備します。
     */
    constructor() {
        Object.defineProperty(this, "_audioContext", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // ロードされた各オーディオインスタンスをIDで管理
        Object.defineProperty(this, "_audioInstances", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // AudioContextの初期化。ブラウザの互換性を考慮してプレフィックスをチェック
        this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this._audioInstances = new Map();
    }
    /**
     * URLからオーディオファイルをロードし、ユニークなIDを返します。
     * @param url ロードするオーディオファイルのURL
     * @returns ロードされたオーディオインスタンスのID
     * @throws ロードまたはデコードに失敗した場合
     */
    async loadFromUrl(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return this.decodeAudioData(arrayBuffer);
        }
        catch (error) {
            console.error("Failed to load audio from URL:", url, error);
            throw error;
        }
    }
    /**
     * Blobからオーディオファイルをロードし、ユニークなIDを返します。
     * @param blob ロードするBlobオブジェクト
     * @returns ロードされたオーディオインスタンスのID
     * @throws ロードまたはデコードに失敗した場合
     */
    async loadFromBlob(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    // ArrayBufferをデコードし、IDを返す
                    const id = await this.decodeAudioData(reader.result);
                    resolve(id);
                }
                catch (error) {
                    console.error("Failed to decode audio from Blob:", error);
                    reject(error);
                }
            };
            reader.onerror = (error) => {
                console.error("Failed to read Blob:", error);
                reject(error);
            };
            reader.readAsArrayBuffer(blob);
        });
    }
    /**
     * ArrayBufferをオーディオデータとしてデコードし、新しいオーディオインスタンスを管理します。
     * @param arrayBuffer デコードするArrayBuffer
     * @returns 新しく作成されたオーディオインスタンスのID
     * @throws デコードに失敗した場合
     */
    async decodeAudioData(arrayBuffer) {
        try {
            const audioBuffer = await this._audioContext.decodeAudioData(arrayBuffer);
            const id = crypto.randomUUID(); // ユニークなIDを生成
            // GainNodeを作成し、AudioContextの出力に接続
            const gainNode = this._audioContext.createGain();
            gainNode.connect(this._audioContext.destination);
            // 新しいオーディオインスタンスをMapに追加
            this._audioInstances.set(id, {
                audioBuffer: audioBuffer,
                gainNode: gainNode,
                sourceNode: null,
                isPlaying: false,
                startTime: 0,
                startOffset: 0,
                loop: false,
                volume: 1, // 初期音量
            });
            return id;
        }
        catch (error) {
            console.error("Failed to decode audio data:", error);
            throw error;
        }
    }
    /**
     * 指定されたIDのオーディオを再生します。
     * @param id 再生するオーディオインスタンスのID
     * @param fadeIn フェードイン時間 (ミリ秒)。デフォルトは0 (即時再生)。
     * @param isRepeat ループ再生するかどうか。デフォルトはfalse。
     * @returns フェードインが完了した時点で解決されるPromise
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合、または再生に失敗した場合
     */
    async play(id, fadeIn = 0, isRepeat = false) {
        const instance = this._audioInstances.get(id);
        if (!instance) {
            throw new Error(`Audio instance with ID ${id} not found.`);
        }
        // 既に再生中の場合は一度停止
        if (instance.isPlaying) {
            this.stop(id, 0); // フェードアウトなしで即時停止
        }
        // 新しいAudioBufferSourceNodeを作成（SourceNodeは一度しか再生できないため、毎回作成）
        instance.sourceNode = this._audioContext.createBufferSource();
        instance.sourceNode.buffer = instance.audioBuffer;
        instance.sourceNode.loop = isRepeat;
        instance.loop = isRepeat; // インスタンスの状態を更新
        // SourceNodeをGainNodeに接続
        instance.sourceNode.connect(instance.gainNode);
        // フェードイン処理
        const now = this._audioContext.currentTime;
        const fadeDuration = fadeIn / 1000; // msを秒に変換
        if (fadeDuration > 0) {
            instance.gainNode.gain.setValueAtTime(0, now); // 現在の音量を0に設定
            instance.gainNode.gain.linearRampToValueAtTime(instance.volume, now + fadeDuration); // フェードイン
        }
        else {
            instance.gainNode.gain.setValueAtTime(instance.volume, now); // 即時最大音量
        }
        // 再生開始
        instance.sourceNode.start(0, instance.startOffset);
        instance.startTime = now;
        instance.isPlaying = true;
        // 再生終了時のイベントリスナー
        instance.sourceNode.onended = () => {
            if (!instance.loop) { // ループ再生でない場合のみ停止状態に
                instance.isPlaying = false;
                instance.startOffset = 0; // 再生位置をリセット
                instance.sourceNode = null; // ソースノードをクリア
            }
        };
        // フェードイン完了を待つPromise
        return new Promise((resolve) => {
            if (fadeDuration > 0) {
                setTimeout(() => resolve(), fadeIn);
            }
            else {
                resolve();
            }
        });
    }
    /**
     * 指定されたIDのオーディオを一時停止します。
     * @param id 一時停止するオーディオインスタンスのID
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合、または一時停止に失敗した場合
     */
    pause(id) {
        const instance = this._audioInstances.get(id);
        if (!instance) {
            throw new Error(`Audio instance with ID ${id} not found.`);
        }
        if (instance.isPlaying && instance.sourceNode) {
            instance.sourceNode.stop();
            instance.isPlaying = false;
            // 現在の再生位置を保存
            instance.startOffset += this._audioContext.currentTime - instance.startTime;
            instance.sourceNode = null; // ソースノードをクリア
        }
    }
    /**
     * 指定されたIDのオーディオを停止します。
     * @param id 停止するオーディオインスタンスのID
     * @param fadeOut フェードアウト時間 (ミリ秒)。デフォルトは0 (即時停止)。
     * @returns フェードアウトが完了し、再生が完全に停止した時点で解決されるPromise
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合、または停止に失敗した場合
     */
    async stop(id, fadeOut = 0) {
        const instance = this._audioInstances.get(id);
        if (!instance) {
            throw new Error(`Audio instance with ID ${id} not found.`);
        }
        if (!instance.isPlaying && !instance.sourceNode) {
            // 既に停止している場合は何もしない
            return Promise.resolve();
        }
        const now = this._audioContext.currentTime;
        const fadeDuration = fadeOut / 1000; // msを秒に変換
        return new Promise((resolve) => {
            if (fadeDuration > 0) {
                // フェードアウト処理
                instance.gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration);
                // フェードアウト完了後に停止
                setTimeout(() => {
                    if (instance.sourceNode) {
                        instance.sourceNode.stop();
                        instance.sourceNode.disconnect(); // ノードの接続を解除
                        instance.sourceNode = null;
                    }
                    instance.isPlaying = false;
                    instance.startOffset = 0; // 再生位置をリセット
                    instance.gainNode.gain.setValueAtTime(instance.volume, this._audioContext.currentTime); // 音量を元に戻す
                    resolve();
                }, fadeOut);
            }
            else {
                // 即時停止
                if (instance.sourceNode) {
                    instance.sourceNode.stop();
                    instance.sourceNode.disconnect(); // ノードの接続を解除
                    instance.sourceNode = null;
                }
                instance.isPlaying = false;
                instance.startOffset = 0; // 再生位置をリセット
                resolve();
            }
        });
    }
    /**
     * 指定されたIDのオーディオの現在の音量を取得します。
     * @param id 音量を取得するオーディオインスタンスのID
     * @returns 現在の音量 (0.0 から 1.0 の範囲)
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合
     */
    getVolume(id) {
        const instance = this._audioInstances.get(id);
        if (!instance) {
            throw new Error(`Audio instance with ID ${id} not found.`);
        }
        return instance.volume;
    }
    /**
     * 指定されたIDのオーディオの音量を設定します。
     * @param id 音量を設定するオーディオインスタンスのID
     * @param volume 設定する音量 (0.0 から 1.0 の範囲)
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合
     */
    setVolume(id, volume) {
        const instance = this._audioInstances.get(id);
        if (!instance) {
            throw new Error(`Audio instance with ID ${id} not found.`);
        }
        instance.volume = Math.max(0, Math.min(1, volume)); // 0から1の範囲にクランプ
        instance.gainNode.gain.setValueAtTime(instance.volume, this._audioContext.currentTime);
    }
    /**
     * 指定されたIDのオーディオの現在の再生位置を取得します。
     * @param id 再生位置を取得するオーディオインスタンスのID
     * @returns 現在の再生位置 (秒)
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合
     */
    getCurrentTime(id) {
        const instance = this._audioInstances.get(id);
        if (!instance) {
            throw new Error(`Audio instance with ID ${id} not found.`);
        }
        if (instance.isPlaying) {
            return instance.startOffset + (this._audioContext.currentTime - instance.startTime);
        }
        return instance.startOffset; // 一時停止中の場合は停止時の位置
    }
    /**
     * 指定されたIDのオーディオの総再生時間を取得します。
     * @param id 総再生時間を取得するオーディオインスタンスのID
     * @returns 総再生時間 (秒)
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合
     */
    getDuration(id) {
        const instance = this._audioInstances.get(id);
        if (!instance) {
            throw new Error(`Audio instance with ID ${id} not found.`);
        }
        return instance.audioBuffer.duration;
    }
    /**
     * 指定されたIDのオーディオインスタンスを破棄します。
     * @param id 破棄するオーディオインスタンスのID
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合
     */
    disposeInstance(id) {
        const instance = this._audioInstances.get(id);
        if (!instance) {
            throw new Error(`Audio instance with ID ${id} not found.`);
        }
        if (instance.isPlaying && instance.sourceNode) {
            instance.sourceNode.stop();
            instance.sourceNode.disconnect();
        }
        instance.gainNode.disconnect();
        this._audioInstances.delete(id);
    }
    /**
     * すべてのオーディオリソースを解放し、AudioContextを閉じます。
     * アプリケーション終了時やコンポーネントアンマウント時に呼び出すべきです。
     */
    disposeAll() {
        this._audioInstances.forEach((_, id) => this.disposeInstance(id));
        if (this._audioContext.state !== 'closed') {
            this._audioContext.close();
        }
    }
}
