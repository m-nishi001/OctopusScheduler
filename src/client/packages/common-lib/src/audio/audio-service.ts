/**
 * 各オーディオインスタンスの状態とノードを管理するインターフェース
 */
interface AudioInstance {
    audioBuffer: AudioBuffer; // デコードされたオーディオデータ
    gainNode: GainNode;       // 音量調整用ノード
    sourceNode: AudioBufferSourceNode | null; // 現在再生中のソースノード (再生ごとに再生成)
    isPlaying: boolean;       // 再生中かどうか
    startTime: number;        // 再生開始時のAudioContext時間 (秒)
    startOffset: number;      // 再生開始時のバッファオフセット (秒)
    loop: boolean;            // ループ再生するかどうか
    volume: number;           // 現在の音量 (0-1)
}

/**
 * Web Audio API を使用して複数のオーディオソースを管理するサービス
 */
export class AudioService {
    private _audioContext: AudioContext;
    // ロードされた各オーディオインスタンスをIDで管理
    private _audioInstances: Map<string, AudioInstance>;

    /**
     * AudioServiceのコンストラクタ
     * AudioContextを初期化し、オーディオインスタンスを管理するMapを準備します。
     */
    constructor() {
        // AudioContextの初期化。ブラウザの互換性を考慮してプレフィックスをチェック
        this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this._audioInstances = new Map<string, AudioInstance>();
    }

    /**
     * URLからオーディオファイルをロードし、ユニークなIDを返します。
     * @param url ロードするオーディオファイルのURL
     * @returns ロードされたオーディオインスタンスのID
     * @throws ロードまたはデコードに失敗した場合
     */
    public async loadFromUrl(url: string): Promise<string> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return this.decodeAudioData(arrayBuffer);
        } catch (error) {
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
    public async loadFromBlob(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    // ArrayBufferをデコードし、IDを返す
                    const id = await this.decodeAudioData(reader.result as ArrayBuffer);
                    resolve(id);
                } catch (error) {
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
    private async decodeAudioData(arrayBuffer: ArrayBuffer): Promise<string> {
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
        } catch (error) {
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
    public async play(id: string, fadeIn: number = 0, isRepeat: boolean = false): Promise<void> {
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
        } else {
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
            } else {
                resolve();
            }
        });
    }

    /**
     * 指定されたIDのオーディオを一時停止します。
     * @param id 一時停止するオーディオインスタンスのID
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合、または一時停止に失敗した場合
     */
    public pause(id: string): void {
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
    public async stop(id: string, fadeOut: number = 0): Promise<void> {
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
            } else {
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
    public getVolume(id: string): number {
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
    public setVolume(id: string, volume: number): void {
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
    public getCurrentTime(id: string): number {
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
    public getDuration(id: string): number {
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
    public disposeInstance(id: string): void {
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
    public disposeAll(): void {
        this._audioInstances.forEach((_, id) => this.disposeInstance(id));
        if (this._audioContext.state !== 'closed') {
            this._audioContext.close();
        }
    }
}
