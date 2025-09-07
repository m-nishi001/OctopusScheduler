import { MovieId } from "../vo/movie-id";

export class Movie {

  private _movieId: MovieId;
  private _movieName: string;
  private _movieData: Blob;

  private constructor(movieId: MovieId, movieName: string, movieData: Blob) {
    this._movieId = movieId;
    this._movieName = movieName;
    this._movieData = movieData;
  }

  public static create(movieName: string, data: Blob, movieId: MovieId | null = null): Movie {
    return new Movie(movieId ?? MovieId.create(), movieName, data);
  }

  public static from(another: Movie): Movie {
    return new Movie(MovieId.from(another._movieId), another._movieName, another._movieData);
  }

  public get movieId(): MovieId {
    return this._movieId;
  }

  public get movieName(): string {
    return this._movieName;
  }

  public get movieData(): Blob {
    return this._movieData;
  }

  public renameMovie(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error("動画名は空にできません。");
    }
    this._movieName = newName;
  }
}