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
  public static createNew(movieName: string, data: Blob): Movie {
    const newId = new MovieId(crypto.randomUUID());
    return new Movie(newId, movieName, data);
  }

  /**
   * 永続化されたデータからMovieエンティティを再構築するためのファクトリーメソッド
   * リポジトリ層でのみ利用されることを想定
   * @param id string形式のID
   * @param name string形式の名前
   * @param data Blobデータ
   * @returns 再構築されたMovieエンティティ
   */
  public static reconstruct(id: string, name: string, data: Blob): Movie {
    return new Movie(new MovieId(id), name, data);
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