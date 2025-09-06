export class ImageId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(id: string | null = null): ImageId {
    return new ImageId(id ?? crypto.randomUUID());
  }

  static from(another: ImageId): ImageId {
    return new ImageId(String(another.value));
  }

  equals(other: ImageId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}