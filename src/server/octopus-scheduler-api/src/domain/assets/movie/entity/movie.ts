
import { MovieId } from "../vo/movie-id";

export class Movie {
  private movieId: MovieId;
  private movieName: string;
  private data: GoogleAppsScript.Base.Blob;

  constructor(movieId: MovieId, movieName: string, data: GoogleAppsScript.Base.Blob) {
    this.movieId = movieId;
    this.movieName = movieName;
    this.data = data;
  }

  public static createNew(movieName: string, data: GoogleAppsScript.Base.Blob): Movie {
    const newId = new MovieId(Utilities.getUuid ? Utilities.getUuid() : (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)));
    return new Movie(newId, movieName, data);
  }

  public static fromEntity(movieId: MovieId, movieName: string, data: GoogleAppsScript.Base.Blob): Movie {
    return new Movie(movieId, movieName, data);
  }

  public get id(): MovieId {
    return this.movieId;
  }

  public get name(): string {
    return this.movieName;
  }

  public get movieData(): GoogleAppsScript.Base.Blob {
    return this.data;
  }

  public renameMovie(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error("動画名は空にできません。");
    }
    this.movieName = newName;
  }
}