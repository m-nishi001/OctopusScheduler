/**
 * Web Audio API を使用して複数のオーディオソースを管理するサービス
 */
export declare class AudioService {
    private _audioContext;
    private _audioInstances;
    /**
     * AudioServiceのコンストラクタ
     * AudioContextを初期化し、オーディオインスタンスを管理するMapを準備します。
     */
    constructor();
    /**
     * URLからオーディオファイルをロードし、ユニークなIDを返します。
     * @param url ロードするオーディオファイルのURL
     * @returns ロードされたオーディオインスタンスのID
     * @throws ロードまたはデコードに失敗した場合
     */
    loadFromUrl(url: string): Promise<string>;
    /**
     * Blobからオーディオファイルをロードし、ユニークなIDを返します。
     * @param blob ロードするBlobオブジェクト
     * @returns ロードされたオーディオインスタンスのID
     * @throws ロードまたはデコードに失敗した場合
     */
    loadFromBlob(blob: Blob): Promise<string>;
    /**
     * ArrayBufferをオーディオデータとしてデコードし、新しいオーディオインスタンスを管理します。
     * @param arrayBuffer デコードするArrayBuffer
     * @returns 新しく作成されたオーディオインスタンスのID
     * @throws デコードに失敗した場合
     */
    private decodeAudioData;
    /**
     * 指定されたIDのオーディオを再生します。
     * @param id 再生するオーディオインスタンスのID
     * @param fadeIn フェードイン時間 (ミリ秒)。デフォルトは0 (即時再生)。
     * @param isRepeat ループ再生するかどうか。デフォルトはfalse。
     * @returns フェードインが完了した時点で解決されるPromise
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合、または再生に失敗した場合
     */
    play(id: string, fadeIn?: number, isRepeat?: boolean): Promise<void>;
    /**
     * 指定されたIDのオーディオを一時停止します。
     * @param id 一時停止するオーディオインスタンスのID
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合、または一時停止に失敗した場合
     */
    pause(id: string): void;
    /**
     * 指定されたIDのオーディオを停止します。
     * @param id 停止するオーディオインスタンスのID
     * @param fadeOut フェードアウト時間 (ミリ秒)。デフォルトは0 (即時停止)。
     * @returns フェードアウトが完了し、再生が完全に停止した時点で解決されるPromise
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合、または停止に失敗した場合
     */
    stop(id: string, fadeOut?: number): Promise<void>;
    /**
     * 指定されたIDのオーディオの現在の音量を取得します。
     * @param id 音量を取得するオーディオインスタンスのID
     * @returns 現在の音量 (0.0 から 1.0 の範囲)
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合
     */
    getVolume(id: string): number;
    /**
     * 指定されたIDのオーディオの音量を設定します。
     * @param id 音量を設定するオーディオインスタンスのID
     * @param volume 設定する音量 (0.0 から 1.0 の範囲)
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合
     */
    setVolume(id: string, volume: number): void;
    /**
     * 指定されたIDのオーディオの現在の再生位置を取得します。
     * @param id 再生位置を取得するオーディオインスタンスのID
     * @returns 現在の再生位置 (秒)
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合
     */
    getCurrentTime(id: string): number;
    /**
     * 指定されたIDのオーディオの総再生時間を取得します。
     * @param id 総再生時間を取得するオーディオインスタンスのID
     * @returns 総再生時間 (秒)
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合
     */
    getDuration(id: string): number;
    /**
     * 指定されたIDのオーディオインスタンスを破棄します。
     * @param id 破棄するオーディオインスタンスのID
     * @throws 指定されたIDのオーディオインスタンスが見つからない場合
     */
    disposeInstance(id: string): void;
    /**
     * すべてのオーディオリソースを解放し、AudioContextを閉じます。
     * アプリケーション終了時やコンポーネントアンマウント時に呼び出すべきです。
     */
    disposeAll(): void;
}
