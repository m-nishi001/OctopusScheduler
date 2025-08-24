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

  public static createNew(movieName: string, data: Blob): Movie {
    const newId = new MovieId(crypto.randomUUID());
    return new Movie(newId, movieName, data);
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