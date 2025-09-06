export class AudioId {
  private readonly id: string;

  private constructor(value: string) {
    this.id = value;
  }

  static create(id: string | null = ""): AudioId {
    return new AudioId(id ?? crypto.randomUUID());
  }

  public equals(other: AudioId): boolean {
    return this.id === other.id;
  }

  public toString(): string {
    return this.id;
  }

  public static from(other: AudioId): AudioId {
    return new AudioId(String(other.id));
  }
}