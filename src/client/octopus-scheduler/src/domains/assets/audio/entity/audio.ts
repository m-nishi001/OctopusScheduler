import { AudioId } from "../vo/audio-id";

export class Audio {
  private audioId: AudioId;
  private audioName: string;
  private data: Blob;

  private constructor(audioId: AudioId, audioName: string, data: Blob) {
    this.audioId = audioId;
    this.audioName = audioName;
    this.data = data;
  }

  /**
   * 新しいオーディオを生成するためのファクトリーメソッド
   * @param audioName オーディオ名
   * @param data Blob形式のオーディオデータ
   * @returns 新しいAudioエンティティ
   */
  public static createNew(audioName: string, data: Blob): Audio {
    const newId = new AudioId(crypto.randomUUID());
    return new Audio(newId, audioName, data);
  }

  /**
   * 永続化されたデータからAudioエンティティを再構築するためのファクトリーメソッド
   * @param id string形式のID
   * @param name string形式の名前
   * @param data Blob形式のデータ
   * @returns 再構築されたAudioエンティティ
   */
  public static reconstruct(id: string, name: string, data: Blob): Audio {
    return new Audio(new AudioId(id), name, data);
  }

  public get id(): AudioId {
    return this.audioId;
  }

  public get name(): string {
    return this.audioName;
  }

  public get audioData(): Blob {
    return this.data;
  }

  public renameAudio(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error("オーディオ名は空にできません。");
    }
    this.audioName = newName;
  }
}