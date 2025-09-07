export class MovieId {
  private readonly id: string;

  private constructor(id: string) {
    this.id = id;
  }

  static create(id: string | null = null): MovieId {
    return new MovieId(id ?? crypto.randomUUID());
  }

  public static from(another: MovieId): MovieId {
    return new MovieId(String(another.id));
  }

  public equals(other: MovieId): boolean {
    return this.id === other.id;
  }

  public toString(): string {
    return this.id;
  }
}