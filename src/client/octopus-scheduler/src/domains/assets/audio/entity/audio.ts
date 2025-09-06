import { AudioId } from "../vo/audio-id";

export class Audio {

  private _audioId: AudioId;
  private _audioName: string;
  private _audioData: Blob;

  private constructor(audioId: AudioId, audioName: string, data: Blob) {
    this._audioId = audioId;
    this._audioName = audioName;
    this._audioData = data;
  }

  public get audioId(): AudioId {
    return this._audioId;
  }

  public get audioName(): string {
    return this._audioName;
  }

  public get audioData(): Blob {
    return this._audioData;
  }

  public static create(audioName: string, data: Blob, audioId: AudioId | null = null): Audio {
    return new Audio(audioId ?? AudioId.create(), audioName, data);
  }

  public static from(another: Audio): Audio {
    return new Audio(AudioId.from(another._audioId), another._audioName, another._audioData);
  }

  public renameAudio(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error("オーディオ名は空にできません。");
    }
    this._audioName = newName;
  }
}