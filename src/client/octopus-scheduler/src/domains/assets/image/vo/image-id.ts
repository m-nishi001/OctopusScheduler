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
}