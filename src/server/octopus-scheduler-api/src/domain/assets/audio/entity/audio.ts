import { AudioId } from "../vo/audio-id";

/**
 * Audioは、単一のオーディオファイルを表すドメインエンティティです。
 */
export class Audio {
  private audioId: AudioId;
  private audioName: string;
  private data: GoogleAppsScript.Base.Blob;

  /**
   * 新規Audioエンティティを生成するファクトリメソッド
   * @param audioName オーディオ名
   * @param data GoogleAppsScript.Base.Blob形式のオーディオデータ
   */
  public static createNew(audioName: string, data: GoogleAppsScript.Base.Blob): Audio {
    // 一意なID生成（ここではタイムスタンプを利用）
    const id = new AudioId(`${Date.now()}`);
    return new Audio(id, audioName, data);
  }

  /**
   * Audioエンティティのコンストラクタ
   * @param audioId オーディオID
   * @param audioName オーディオ名
   * @param data GoogleAppsScript.Base.Blob形式のオーディオデータ
   */
  constructor(audioId: AudioId, audioName: string, data: GoogleAppsScript.Base.Blob) {
    this.audioId = audioId;
    this.audioName = audioName;
    this.data = data;
  }

  public get id(): AudioId {
    return this.audioId;
  }

  public get name(): string {
    return this.audioName;
  }

  public get audioData(): GoogleAppsScript.Base.Blob {
    return this.data;
  }

  /**
   * オーディオファイルの名前を変更します。
   */
  public renameAudio(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error("オーディオ名は空にできません。");
    }
    this.audioName = newName;
  }
}

