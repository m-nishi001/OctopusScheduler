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
  
  /**
   * Create AudioId from a plain value or object returned from deserialization
   */
  public static from(value: unknown): AudioId {
    if (value instanceof AudioId) return value;
    if (typeof value === 'string') return new AudioId(value);
    const val = value as Record<string, unknown> | undefined;
    if (val && typeof val.id === 'string') return new AudioId(val.id);
    if (val && typeof val.value === 'string') return new AudioId(val.value);
    return new AudioId(String(value));
  }
}