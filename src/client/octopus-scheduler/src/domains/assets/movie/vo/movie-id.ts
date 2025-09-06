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
  
  public static from(value: unknown): MovieId {
    if (value instanceof MovieId) return value;
    if (typeof value === 'string') return new MovieId(value);
    const val = value as Record<string, unknown> | undefined;
    if (val && typeof val.id === 'string') return new MovieId(val.id);
    if (val && typeof val.value === 'string') return new MovieId(val.value);
    return new MovieId(String(value));
  }
}