import { MovieId } from "../vo/movie-id";

export class Movie {

  private movieId: MovieId;
  private movieName: string;
  private data: Blob;

  private constructor(movieId: MovieId, movieName: string, data: Blob) {
    this.movieId = movieId;
    this.movieName = movieName;
    this.data = data;
  }

  /**
   * 新しい動画を生成するためのファクトリーメソッド
   * @param movieName 動画名
   * @param data Blobデータ
   * @returns 新しいMovieエンティティ
   */
  public static create(movieName: string, data: Blob): Movie {
    const newId = new MovieId(crypto.randomUUID());
    return new Movie(newId, movieName, data);
  }

  /**
   * Create or rehydrate Movie from a plain object or Movie instance
   */
  public static from(obj: unknown): Movie {
    if (obj instanceof Movie) return obj;
    const plain = obj as Partial<Record<string, unknown>> | undefined;
    const rawId = plain?.movieId ?? plain?.id ?? plain?.movieID;
    const movieId = MovieId.from(rawId as unknown);
    const name = (plain?.movieName ?? plain?.name ?? "") as string;
    const data = (plain?.movieData ?? plain?.data) as Blob;
    return new Movie(movieId, name, data as Blob);
  }

  // Backwards-compatible aliases
  public static createNew(movieName: string, data: Blob): Movie {
    return Movie.create(movieName, data);
  }

  public static reconstruct(id: string, name: string, data: Blob): Movie {
    return new Movie(new MovieId(id), name, data);
  }

  public static reconstructFromObject(obj: unknown): Movie {
    return Movie.from(obj);
  }

  public get id(): MovieId {
    return this.movieId;
  }

  public get name(): string {
    return this.movieName;
  }

  public get movieData(): Blob {
    return this.data;
  }

  public renameMovie(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error("動画名は空にできません。");
    }
    this.movieName = newName;
  }
}