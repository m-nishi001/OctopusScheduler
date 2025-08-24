import { AudioId } from "../vo/audio-id";

/**
 * Audioは、単一のオーディオファイルを表すドメインエンティティです。
 */
export class Audio {
  private audioId: AudioId;
  private audioName: string;
  private data: GoogleAppsScript.Base.Blob;

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

