import type { IMovieRepository } from "../../../../domains/assets/movie/repository/movie-repository";

export class SyncMoviesUseCase {
  constructor(private readonly movieRepository: IMovieRepository) {}

  async execute(): Promise<void> {
    await this.movieRepository.sync();
  }
}
