export class MovieId {
  private readonly value: string;

  constructor(value: string) {
    if (!value) {
      throw new Error("MovieIdは空にできません。");
    }
    this.value = value;
  }

  public equals(other: MovieId): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}