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
  public static create(audioName: string, data: Blob): Audio {
    const newId = new AudioId(crypto.randomUUID());
    return new Audio(newId, audioName, data);
  }

  public static from(obj: unknown): Audio {
    if (obj instanceof Audio) return obj;
    const plain = obj as Partial<Record<string, unknown>> | undefined;
    const rawId = plain?.audioId ?? plain?.id ?? plain?.audioID;
    const audioId = AudioId.from(rawId as unknown);
    const name = (plain?.audioName ?? plain?.name ?? "") as string;
    const data = (plain?.audioData ?? plain?.data) as Blob;
    return new Audio(audioId, name, data as Blob);
  }

  // compatibility aliases
  public static createNew(audioName: string, data: Blob): Audio {
    return Audio.create(audioName, data);
  }

  public static reconstruct(id: string, name: string, data: Blob): Audio {
    return new Audio(new AudioId(id), name, data);
  }

  public static reconstructFromObject(obj: unknown): Audio {
    return Audio.from(obj);
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