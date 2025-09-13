export class PlayMovieEventDetail {
  movieUrl: string;
  startTime?: number;
  constructor(movieUrl: string, startTime?: number) {
    this.movieUrl = movieUrl;
    this.startTime = startTime;
  }
}
