export class ImageId {
  private readonly value: string;

  constructor(value: string) {
    if (!value) {
      throw new Error("ImageIdは空にできません。");
    }
    this.value = value;
  }

  public equals(other: ImageId): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }

  public static from(value: unknown): ImageId {
    if (value instanceof ImageId) return value;
    if (typeof value === 'string') return new ImageId(value);
    const val = value as Record<string, unknown> | undefined;
    if (val && typeof val.id === 'string') return new ImageId(val.id);
    if (val && typeof val.value === 'string') return new ImageId(val.value);
    return new ImageId(String(value));
  }
}