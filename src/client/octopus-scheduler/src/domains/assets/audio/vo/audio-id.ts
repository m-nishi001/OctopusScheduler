export class AudioId {
  private readonly id: string;

  constructor(value: string) {
    if (!value) {
      throw new Error("AudioIdは空にできません。");
    }
    this.id = value;
  }

  public equals(other: AudioId): boolean {
    return this.id === other.id;
  }

  public toString(): string {
    return this.id;
  }
}