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
    /** フェードアウト中の停止。あれば、同じ曲への2回目のフェード停止は、これの完了を待つだけにする。 */
    stopping: { done: Promise<void>; finish: () => void } | null;
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

    /** 音を出せる状態か(`running`)。ブラウザの自動再生の制限の間は `suspended`。 */
    public get state(): AudioContextState {
        return this._audioContext.state;
    }

    /**
     * 自動再生の制限を解除する。クリックなどの利用者の操作の中で呼ぶこと。
     * すでに `running` なら何もしない。解除できなくても(操作の外で呼ばれたときなど)例外にしない。
     */
    public async unlock(): Promise<void> {
        if (this._audioContext.state === "running") return;
        try {
            await this._audioContext.resume();
        } catch {
            // 利用者の操作が無いと拒否されることがある。状態は `state` で分かる
        }
    }

    /** 状態(`state`)が変わったときに呼ぶ。戻り値は解除関数。 */
    public onStateChange(listener: () => void): () => void {
        this._audioContext.addEventListener("statechange", listener);
        return () => this._audioContext.removeEventListener("statechange", listener);
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
                stopping: null,
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
     * @param onEnded 曲が最後まで再生されて自然に終わったときに呼ぶ(`stop` や `pause` では呼ばない。ループ再生では呼ばれない)。
     * @returns フェードインが完了した時点で解決されるPromise
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合、または再生に失敗した場合
     */
    public async play(id: string, fadeIn: number = 0, isRepeat: boolean = false, onEnded?: () => void): Promise<void> {
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
        const source = instance.sourceNode;
        source.start(0, instance.startOffset);
        instance.startTime = now;
        instance.isPlaying = true;

        // 再生終了時のイベントリスナー。`stop` / `pause` のあとにも呼ばれるが、そのときは
        // `instance.sourceNode` が別(null や、再生し直した新しいノード)なので、何もしない。
        source.onended = () => {
            if (instance.sourceNode !== source) return;
            if (!instance.loop) { // ループ再生でない場合のみ停止状態に
                instance.isPlaying = false;
                instance.startOffset = 0; // 再生位置をリセット
                instance.sourceNode = null; // ソースノードをクリア
                onEnded?.();
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
     * 指定されたIDのオーディオを一時停止します。再生位置(startOffset)は残り、次の play で続きから鳴ります。
     * ループ再生の曲は、位置を曲の長さで割った余りにします。
     * @param id 一時停止するオーディオインスタンスのID
     * @param fadeOut フェードアウト時間 (ミリ秒)。デフォルトは0 (即時一時停止)。
     * @returns フェードアウトが完了し、一時停止した時点で解決されるPromise
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合
     */
    public async pause(id: string, fadeOut: number = 0): Promise<void> {
        const instance = this._audioInstances.get(id);
        if (!instance) {
            throw new Error(`Audio instance with ID ${id} not found.`);
        }
        if (!instance.isPlaying || !instance.sourceNode) return;

        if (fadeOut > 0) {
            const source = instance.sourceNode;
            const now = this._audioContext.currentTime;
            instance.gainNode.gain.setValueAtTime(instance.volume, now);
            instance.gainNode.gain.linearRampToValueAtTime(0, now + fadeOut / 1000);
            await new Promise<void>((resolve) => setTimeout(resolve, fadeOut));
            // 待っている間に止められた・鳴らし直された場合は、何もしない
            if (instance.sourceNode !== source) return;
        }

        const source = instance.sourceNode;
        source.stop();
        source.disconnect();
        instance.isPlaying = false;
        // 現在の再生位置を保存
        let offset = instance.startOffset + (this._audioContext.currentTime - instance.startTime);
        const duration = instance.audioBuffer.duration;
        if (instance.loop && duration > 0) offset %= duration;
        instance.startOffset = offset;
        instance.sourceNode = null; // ソースノードをクリア
        // フェードアウトで絞った音量を戻す(次の再生は play が設定する)
        instance.gainNode.gain.setValueAtTime(instance.volume, this._audioContext.currentTime);
    }

    /**
     * 指定されたIDのオーディオを停止します。
     * フェードアウトするときは、いまの音量を起点に置いてから 0 まで下げる
     * (起点が無いと、Web Audio は直前の予定(再生開始時の設定)から補間するため、長く鳴った曲ほど一瞬で 0 に落ちる)。
     * フェードアウト中にもう一度フェード付きで呼んでも、下げ直さず、最初の停止の完了を待つ。
     * フェードなし(0)で呼ぶと、フェードの途中でも即時に止める。
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
            return;
        }

        const gain = instance.gainNode.gain;
        const now = this._audioContext.currentTime;

        if (fadeOut > 0) {
            if (instance.stopping) return instance.stopping.done; // フェードアウト中。下げ直さない

            gain.cancelScheduledValues(now);
            gain.setValueAtTime(gain.value, now); // 起点。これが無いと、補間が昔の予定から始まる
            gain.linearRampToValueAtTime(0, now + fadeOut / 1000);

            let timer: ReturnType<typeof setTimeout> | undefined;
            let resolveDone: () => void = () => undefined;
            const done = new Promise<void>((resolve) => {
                resolveDone = resolve;
            });
            const finish = () => {
                clearTimeout(timer);
                instance.stopping = null;
                this.haltSource(instance);
                resolveDone();
            };
            instance.stopping = { done, finish };
            timer = setTimeout(finish, fadeOut);
            return done;
        }

        // 即時停止。フェードの途中なら、その完了を待っている呼び出しも終わらせる
        if (instance.stopping) instance.stopping.finish();
        else this.haltSource(instance);
    }

    /** 音を止め、次の再生に備えて状態と音量を戻す。 */
    private haltSource(instance: AudioInstance): void {
        if (instance.sourceNode) {
            instance.sourceNode.stop();
            instance.sourceNode.disconnect(); // ノードの接続を解除
            instance.sourceNode = null;
        }
        instance.isPlaying = false;
        instance.startOffset = 0; // 再生位置をリセット
        const gain = instance.gainNode.gain;
        const now = this._audioContext.currentTime;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(instance.volume, now); // 音量を元に戻す
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
